#include "application.h"

#include "annotation_store.h"
#include "app_config.h"
#include "cli_options.h"
#include "command_palette.h"
#include "document_session.h"
#include "library_manager.h"
#include "logger.h"
#include "navigation_history.h"
#include "ocr_index.h"
#include "plugins/format_registry.h"
#include "portable_store.h"
#include "print_plan.h"
#include "reading_settings.h"
#include "view_mode.h"
#include "version.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>

namespace ods {

namespace {

void EnsureRuntimeLayout(const std::string& root) {
    namespace fs = std::filesystem;
    fs::create_directories(fs::path(root) / "config");
    fs::create_directories(fs::path(root) / "cache");
    fs::create_directories(fs::path(root) / "logs");
}

void PrintDoctor(const std::string& root) {
    namespace fs = std::filesystem;
    std::cout << "Doctor report:" << std::endl;
    std::cout << "  cwd=" << root << std::endl;
    std::cout << "  config=" << (fs::exists(fs::path(root)/"config") ? "ok" : "missing") << std::endl;
    std::cout << "  cache=" << (fs::exists(fs::path(root)/"cache") ? "ok" : "missing") << std::endl;
    std::cout << "  logs=" << (fs::exists(fs::path(root)/"logs") ? "ok" : "missing") << std::endl;
    std::cout << "  network_policy=offline-only" << std::endl;
}

void PrintLibrary(const LibraryManager& library) {
    const auto& data = library.Data();
    std::cout << "Library recent:" << std::endl;
    for (const auto& item : data.recent) std::cout << "  - " << item << std::endl;
    std::cout << "Library pinned:" << std::endl;
    for (const auto& item : data.pinned) std::cout << "  - " << item << std::endl;
}

void PrintHelp() {
    std::cout << "Interactive commands: open/find/mode/fit/zoom/overview/rotate/crop/delete/ocr/screenshot/print/library/pin/unpin/searchlib/back/forward/hotkeys/help/quit" << std::endl;
}

void PrintCliHelp() {
    std::cout
        << "Usage: offline_doc_studio [options] [files...]\n"
        << "  --open <file>            Open document\n"
        << "  --interactive            Run interactive shell\n"
        << "  --script <file>          Execute command script\n"
        << "  --import-folder <dir>    Import folder into library\n"
        << "  --list-library           Print library state\n"
        << "  --theme <light|dark>     Set theme\n"
        << "  --fit <page|width|height|minside|actual>\n"
        << "  --zoom <percent>         Set zoom\n"
        << "  --doctor                 Print diagnostics\n"
        << "  --init-layout            Create runtime layout folders\n"
        << "  --version                Print app version and exit\n"
        << "  --help, -h               Print this help and exit\n";
}

void PrintStatus(const DocumentSession& session, const FormatRegistry& formats, const ReadingSettings& settings) {
    std::cout << kAppName << " " << kAppVersion << " (" << kReleaseChannel << ")" << std::endl;
    std::cout << "Supported formats: ";
    const auto supported = formats.SupportedFormats();
    for (std::size_t i = 0; i < supported.size(); ++i) {
        std::cout << supported[i] << (i + 1 < supported.size() ? ", " : "\n");
    }
    std::cout << "Open tabs: " << session.Tabs().size() << std::endl;
    std::cout << "Reading settings: theme=" << settings.theme << ", fit=" << ToString(settings.fit_mode) << ", zoom=" << settings.zoom_percent << "%" << std::endl;
    if (!session.Tabs().empty()) {
        const auto& tab = session.Tabs().back();
        std::cout << "Active format: " << tab.document.format << std::endl;
        std::cout << "Pages: " << tab.document.PageCount() << std::endl;
        std::cout << "View mode: " << ToString(tab.view_mode) << std::endl;
        std::cout << "Page 1 state: rotation=" << tab.document.pages[0].rotation_degrees
                  << ", cropped=" << (tab.document.pages[0].cropped ? "yes" : "no") << std::endl;
    }
}

} // namespace

int Application::Run(int argc, char** argv) {
    CliOptions options = CliOptions::Parse(argc, argv);
    const std::string root = std::filesystem::current_path().string();
    if (options.show_version) {
        std::cout << kAppName << " " << kAppVersion << " (" << kReleaseChannel << ")" << std::endl;
        return 0;
    }
    if (options.show_help) {
        PrintCliHelp();
        return 0;
    }
    if (options.init_layout) { EnsureRuntimeLayout(root); }
    PortableStore store(root);
    Logger log(root);
    FormatRegistry formats;
    OcrIndex ocr;
    NavigationHistory nav;
    LibraryManager library(store, formats);
    AppConfigStore config_store(root);
    AppConfig config = config_store.Load();
    ReadingSettings settings = config.reading;

    auto hotkeys = store.LoadHotkeys();
    if (options.import_hotkeys_path.has_value()) {
        hotkeys = PortableStore::LoadHotkeysFromPath(options.import_hotkeys_path.value());
    }

    auto previous = store.LoadSession();
    DocumentSession session;
    for (const auto& tab_path : previous.tabs) {
        if (auto doc = formats.Open(tab_path)) {
            session.OpenTab(*doc);
            ocr.IndexDocument(*doc);
            nav.Visit(1);
        }
    }

    if (options.import_folder) library.ImportFolder(*options.import_folder);
    if (options.pin_path) library.Pin(*options.pin_path);
    if (options.unpin_path) library.Unpin(*options.unpin_path);
    if (options.theme) settings.theme = *options.theme;
    if (options.fit_mode) settings.fit_mode = *options.fit_mode;
    if (options.zoom_percent) settings.zoom_percent = *options.zoom_percent;

    const int open_page = options.page.value_or(1);
    for (const auto& path : options.files_to_open) {
        if (!formats.Supports(path)) {
            std::cout << "Skip unsupported format: " << path << std::endl;
            log.Info("Unsupported format: " + path);
            continue;
        }
        auto doc = formats.Open(path);
        if (!doc) {
            std::cout << "Failed to open: " << path << std::endl;
            continue;
        }
        session.OpenTab(*doc, open_page);
        nav.Visit(open_page);
        if (doc->IsImageLike()) ocr.IndexDocument(*doc);
        library.AddRecent(path);
    }

    if (options.view_mode) session.SetViewMode(*options.view_mode);

    auto execute_simple_command = [&](const std::string& line) {
        if (line.empty()) return;
        if (auto resolved = ResolveCommand(line)) {
            switch (*resolved) {
                case Command::Overview: options.show_pages_overview = true; break;
                case Command::OcrPage: options.run_ocr_page = true; break;
                case Command::Screenshot: options.copy_selection_as_image = true; break;
                case Command::Rotate90: options.rotate_degrees = 90; break;
                case Command::CropPage: options.crop_page = 1; break;
                case Command::DeletePage: options.delete_page = 1; break;
                case Command::ToggleAnnotations: options.hide_annotations = !options.hide_annotations; break;
                case Command::Find: if (!options.find_query) options.find_query = "theorem"; break;
                case Command::Open: break;
            }
            return;
        }

        std::istringstream in(line);
        std::string cmd;
        in >> cmd;
        if (cmd == "find") {
            std::string q; std::getline(in, q); if (!q.empty() && q[0]==' ') q.erase(0,1); options.find_query=q;
        } else if (cmd == "mode") {
            std::string m; in >> m; if (auto vm = ParseViewMode(m)) session.SetViewMode(*vm);
        } else if (cmd == "fit") {
            std::string f; in >> f; if (auto fm = ParseFitMode(f)) settings.fit_mode = *fm;
        } else if (cmd == "zoom") {
            int z=100; in >> z; settings.zoom_percent = z;
        } else if (cmd == "rotate") {
            int d=0; in>>d; session.RotatePage(0,d);
        } else if (cmd == "crop") {
            std::size_t p=1; in>>p; if(p>0) session.CropPage(p-1);
        } else if (cmd == "delete") {
            std::size_t p=1; in>>p; if(p>0) session.DeletePage(p-1);
        } else if (cmd == "print") {
            std::string r; in>>r; options.print_range = r.empty()?"all":r;
        } else if (cmd == "pin") {
            std::string p; in>>p; library.Pin(p);
        } else if (cmd == "unpin") {
            std::string p; in>>p; library.Unpin(p);
        } else if (cmd == "searchlib") {
            std::string q; std::getline(in,q); if(!q.empty()&&q[0]==' ') q.erase(0,1); for (auto& x: library.Search(q)) std::cout<<"  "<<x<<std::endl;
        }
    };

    if (options.command_palette_query) {
        std::cout << "Command palette resolved: " << *options.command_palette_query << std::endl;
        execute_simple_command(*options.command_palette_query);
    }

    if (options.script_file) {
        std::ifstream script(*options.script_file);
        std::string line;
        while (std::getline(script, line)) {
            execute_simple_command(line);
        }
    }

    if (options.nav_back) { auto p = nav.Back(); std::cout << "Navigation back: " << (p?std::to_string(*p):"n/a") << std::endl; }
    if (options.nav_forward) { auto p = nav.Forward(); std::cout << "Navigation forward: " << (p?std::to_string(*p):"n/a") << std::endl; }

    if (options.rotate_degrees && !session.Tabs().empty()) session.RotatePage(0,*options.rotate_degrees);
    if (options.delete_page && *options.delete_page > 0 && !session.Tabs().empty()) session.DeletePage(*options.delete_page - 1);
    if (options.crop_page && *options.crop_page > 0 && !session.Tabs().empty()) session.CropPage(*options.crop_page - 1);

    AnnotationStore annotations;
    if (!session.Tabs().empty()) {
        const int welcome = annotations.Add(1, "note", "Welcome annotation");
        annotations.Add(1, "highlight", "Home tab should expose OCR and Screenshot");
        if (options.hide_annotations) annotations.ToggleHidden(welcome);
    }

    if (options.list_library) PrintLibrary(library);
    if (options.doctor) PrintDoctor(root);

    if (options.interactive) {
        std::cout << "OfflineDocStudio interactive shell" << std::endl;
        PrintHelp();
        std::string line;
        while (true) {
            std::cout << "ods> ";
            if (!std::getline(std::cin, line)) break;
            if (line == "quit" || line == "exit") break;
            if (line == "help") { PrintHelp(); continue; }
            if (line == "library") { PrintLibrary(library); continue; }
            if (line == "back") { auto p=nav.Back(); std::cout << "back => " << (p?std::to_string(*p):"n/a") << std::endl; continue; }
            if (line == "forward") { auto p=nav.Forward(); std::cout << "forward => " << (p?std::to_string(*p):"n/a") << std::endl; continue; }
            if (line == "hotkeys") { options.show_hotkeys_sheet = true; continue; }
            if (line == "overview") { options.show_pages_overview = true; continue; }
            if (line == "ocr") { options.run_ocr_page = true; continue; }
            if (line == "screenshot") { options.copy_selection_as_image = true; continue; }
            if (line.rfind("open ", 0) == 0) {
                const std::string path = line.substr(5);
                if (formats.Supports(path)) {
                    if (auto doc = formats.Open(path)) {
                        session.OpenTab(*doc, 1);
                        library.AddRecent(path);
                        if (doc->IsImageLike()) ocr.IndexDocument(*doc);
                        nav.Visit(1);
                        std::cout << "opened " << path << std::endl;
                    }
                }
                continue;
            }
            execute_simple_command(line);
        }
    }

    PrintStatus(session, formats, settings);

    if (options.find_query) {
        auto found = session.SearchFirst(*options.find_query);
        if (!found && !session.Tabs().empty()) {
            const auto& tab = session.Tabs().back();
            const auto ocr_pages = ocr.FindPages(tab.document.path, *options.find_query);
            if (!ocr_pages.empty()) found = ocr_pages.front();
        }
        std::cout << "Find request: \"" << *options.find_query << "\" " << (found ? ("found on page " + std::to_string(*found)) : "has no matches") << std::endl;
    }

    if (options.show_pages_overview && !session.Tabs().empty()) {
        std::cout << "Pages overview:" << std::endl;
        const auto& pages = session.Tabs().back().document.pages;
        for (std::size_t i = 0; i < pages.size(); ++i) {
            std::cout << "  - page " << (i + 1) << " (chars=" << pages[i].content.size() << ", rotate=" << pages[i].rotation_degrees << ", cropped=" << (pages[i].cropped ? "yes" : "no") << ")" << std::endl;
        }
    }

    if (options.run_ocr_page) std::cout << "OCR(page): simulated offline OCR completed (language=RU default)." << std::endl;
    if (options.copy_selection_as_image) std::cout << "Screenshot tool: simulated copy selection as PNG to clipboard." << std::endl;

    if (options.print_range && !session.Tabs().empty()) {
        auto plan = ParsePrintPlan(*options.print_range, session.Tabs().back().document.PageCount(), !options.print_without_annotations);
        if (plan) {
            std::cout << "Print plan pages:";
            for (const auto page : plan->pages) std::cout << ' ' << page;
            std::cout << " | annotations=" << (plan->include_annotations ? "on" : "off") << std::endl;
        } else {
            std::cout << "Invalid print range" << std::endl;
        }
    }

    if (options.show_hotkeys_sheet) {
        std::cout << "Hotkeys:" << std::endl;
        for (const auto& [action, binding] : hotkeys) std::cout << "  - " << action << " = " << binding << std::endl;
    }

    std::cout << "Visible annotations: " << annotations.List(false).size() << std::endl;

    SessionData persist_session;
    for (const auto& tab : session.Tabs()) persist_session.tabs.push_back(tab.document.path);
    persist_session.active_index = persist_session.tabs.empty() ? 0 : static_cast<int>(persist_session.tabs.size() - 1);

    config.reading = settings;
    config_store.Save(config);
    library.Persist();
    store.SaveSession(persist_session);
    store.SaveHotkeys(hotkeys);
    if (options.export_hotkeys_path) PortableStore::SaveHotkeysToPath(*options.export_hotkeys_path, hotkeys);

    log.Info("Run finished");
    return 0;
}

} // namespace ods

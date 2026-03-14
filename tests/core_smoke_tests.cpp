#include "core/annotation_store.h"
#include "core/app_config.h"
#include "core/cli_options.h"
#include "core/command_palette.h"
#include "core/document_model.h"
#include "core/document_session.h"
#include "core/library_manager.h"
#include "core/logger.h"
#include "core/navigation_history.h"
#include "core/ocr_index.h"
#include "core/plugins/format_registry.h"
#include "core/portable_store.h"
#include "core/print_plan.h"
#include "core/reading_settings.h"
#include "core/view_mode.h"
#include "core/version.h"

#include <cassert>
#include <filesystem>
#include <fstream>

int main() {
    {
        static_assert(ods::kAppName.size() > 0);
        static_assert(ods::kAppVersion.size() > 0);
    }
    {
        const char* argv[] = {
            "app", "--open", "book.pdf", "--page", "9", "--find", "integral", "--theme", "dark", "--fit", "width", "--zoom", "125",
            "--hotkeys", "--mode", "continuous", "--overview", "--ocr-page", "--copy-image", "--rotate", "90", "--delete-page", "2",
            "--crop-page", "1", "--print-range", "1-2", "--print-no-annotations", "--hide-annotations", "--command", "overview",
            "--back", "--forward", "--interactive", "--list-library", "--import-folder", "/tmp", "--pin", "a.pdf", "--unpin", "a.pdf",
            "--script", "a.txt", "--export-hotkeys", "hk1.json", "--import-hotkeys", "hk2.json", "--doctor", "--init-layout", "--version", "--help"
        };
        const int argc = static_cast<int>(sizeof(argv) / sizeof(argv[0]));
        auto options = ods::CliOptions::Parse(argc, const_cast<char**>(argv));
        assert(options.theme.value() == "dark");
        assert(options.fit_mode.has_value() && options.fit_mode.value() == ods::FitMode::FitWidth);
        assert(options.zoom_percent.value() == 125);
        assert(options.script_file.value() == "a.txt");
        assert(options.export_hotkeys_path.value() == "hk1.json");
        assert(options.import_hotkeys_path.value() == "hk2.json");
        assert(options.doctor);
        assert(options.init_layout);
        assert(options.show_version);
        assert(options.show_help);
    }

    {
        assert(ods::ParseFitMode("page").value() == ods::FitMode::FitPage);
        assert(ods::ToString(ods::FitMode::FitMinSide) == "minside");
    }

    {
        ods::DocumentSession session;
        ods::DocumentModel doc{"a.pdf", "pdf", {{"alpha", 0, false}, {"beta integral", 0, false}}};
        session.OpenTab(doc, 3);
        assert(session.SearchFirst("integral").value() == 2);
        assert(session.RotatePage(0, 90));
        assert(session.CropPage(0));
        assert(session.DeletePage(1));
    }

    {
        ods::NavigationHistory history;
        history.Visit(1); history.Visit(3); history.Visit(6);
        assert(history.Back().value() == 3);
        assert(history.Forward().value() == 6);
    }

    {
        const auto tmp = std::filesystem::temp_directory_path() / "ods_store_test";
        std::filesystem::remove_all(tmp);
        std::filesystem::create_directories(tmp / "docs");
        std::ofstream(tmp / "docs" / "x.pdf") << "a";
        std::ofstream(tmp / "docs" / "y.djvu") << "b";

        ods::PortableStore store(tmp.string());
        ods::FormatRegistry registry;
        ods::LibraryManager library(store, registry);
        library.ImportFolder((tmp / "docs").string());
        library.Pin((tmp / "docs" / "x.pdf").string());
        library.AddRecent((tmp / "docs" / "y.djvu").string());
        assert(!library.Search("x.pdf").empty());
        library.Persist();

        auto loaded = store.LoadLibrary();
        assert(!loaded.recent.empty());

        std::map<std::string, std::string> hotkeys = {{"open_file", "Ctrl+O"}, {"screenshot", "Ctrl+Alt+X"}};
        store.SaveHotkeys(hotkeys);
        const auto ext_path = (tmp / "export_hotkeys.json").string();
        ods::PortableStore::SaveHotkeysToPath(ext_path, hotkeys);
        auto loaded_hotkeys = ods::PortableStore::LoadHotkeysFromPath(ext_path);
        assert(loaded_hotkeys.at("screenshot") == "Ctrl+Alt+X");

        ods::Logger logger(tmp.string());
        logger.Info("test line");
        assert(std::filesystem::exists(tmp / "logs" / "app.log"));
    }

    {
        const auto tmp = std::filesystem::temp_directory_path() / "ods_format_test.djvu";
        std::ofstream out(tmp); out << "page1\fpage2 integral"; out.close();
        ods::FormatRegistry registry;
        auto doc = registry.Open(tmp.string());
        assert(doc.has_value() && doc->PageCount() == 2);

        ods::OcrIndex index;
        index.IndexDocument(*doc);
        auto found_pages = index.FindPages(doc->path, "integral");
        assert(found_pages.size() == 1 && found_pages.front() == 2);
    }

    {
        auto plan = ods::ParsePrintPlan("1,3-4", 5, false);
        assert(plan.has_value() && plan->pages.size() == 3 && !plan->include_annotations);
    }

    {
        const auto cmd = ods::ResolveCommand("rotate 90");
        assert(cmd.has_value() && cmd.value() == ods::Command::Rotate90);
    }

    {
        ods::AnnotationStore notes;
        const int id = notes.Add(1, "note", "test");
        assert(notes.ToggleHidden(id));
        assert(notes.ToggleLocked(id));
    }

    {
        const auto tmp = std::filesystem::temp_directory_path() / "ods_config_test";
        std::filesystem::remove_all(tmp);
        ods::AppConfigStore cfg(tmp.string());
        ods::AppConfig data;
        data.debug_logs = true;
        data.reading.theme = "dark";
        data.reading.fit_mode = ods::FitMode::FitWidth;
        data.reading.zoom_percent = 130;
        cfg.Save(data);

        auto loaded = cfg.Load();
        assert(loaded.debug_logs);
        assert(loaded.reading.theme == "dark");
        assert(loaded.reading.fit_mode == ods::FitMode::FitWidth);
        assert(loaded.reading.zoom_percent == 130);
    }

    return 0;
}

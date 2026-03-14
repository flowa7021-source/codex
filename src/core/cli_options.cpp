#include "cli_options.h"

#include <cstdlib>
#include <string>

namespace ods {

CliOptions CliOptions::Parse(int argc, char** argv) {
    CliOptions options;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if ((arg == "--open" || arg == "-o") && i + 1 < argc) { options.files_to_open.push_back(argv[++i]); continue; }
        if ((arg == "--page" || arg == "-p") && i + 1 < argc) { options.page = std::atoi(argv[++i]); continue; }
        if ((arg == "--find" || arg == "-f") && i + 1 < argc) { options.find_query = argv[++i]; continue; }
        if (arg == "--mode" && i + 1 < argc) { options.view_mode = ParseViewMode(argv[++i]); continue; }
        if (arg == "--rotate" && i + 1 < argc) { options.rotate_degrees = std::atoi(argv[++i]); continue; }
        if (arg == "--delete-page" && i + 1 < argc) { options.delete_page = static_cast<std::size_t>(std::atoi(argv[++i])); continue; }
        if (arg == "--crop-page" && i + 1 < argc) { options.crop_page = static_cast<std::size_t>(std::atoi(argv[++i])); continue; }
        if (arg == "--print-range" && i + 1 < argc) { options.print_range = argv[++i]; continue; }
        if (arg == "--command" && i + 1 < argc) { options.command_palette_query = argv[++i]; continue; }
        if (arg == "--import-folder" && i + 1 < argc) { options.import_folder = argv[++i]; continue; }
        if (arg == "--pin" && i + 1 < argc) { options.pin_path = argv[++i]; continue; }
        if (arg == "--unpin" && i + 1 < argc) { options.unpin_path = argv[++i]; continue; }
        if (arg == "--script" && i + 1 < argc) { options.script_file = argv[++i]; continue; }
        if (arg == "--export-hotkeys" && i + 1 < argc) { options.export_hotkeys_path = argv[++i]; continue; }
        if (arg == "--import-hotkeys" && i + 1 < argc) { options.import_hotkeys_path = argv[++i]; continue; }
        if (arg == "--theme" && i + 1 < argc) { options.theme = argv[++i]; continue; }
        if (arg == "--fit" && i + 1 < argc) { options.fit_mode = ParseFitMode(argv[++i]); continue; }
        if (arg == "--zoom" && i + 1 < argc) { options.zoom_percent = std::atoi(argv[++i]); continue; }
        if (arg == "--interactive") { options.interactive = true; continue; }
        if (arg == "--version") { options.show_version = true; continue; }
        if (arg == "--help" || arg == "-h") { options.show_help = true; continue; }
        if (arg == "--doctor") { options.doctor = true; continue; }
        if (arg == "--init-layout") { options.init_layout = true; continue; }
        if (arg == "--list-library") { options.list_library = true; continue; }
        if (arg == "--back") { options.nav_back = true; continue; }
        if (arg == "--forward") { options.nav_forward = true; continue; }
        if (arg == "--print-no-annotations") { options.print_without_annotations = true; continue; }
        if (arg == "--hotkeys") { options.show_hotkeys_sheet = true; continue; }
        if (arg == "--overview") { options.show_pages_overview = true; continue; }
        if (arg == "--ocr-page") { options.run_ocr_page = true; continue; }
        if (arg == "--copy-image") { options.copy_selection_as_image = true; continue; }
        if (arg == "--hide-annotations") { options.hide_annotations = true; continue; }
        if (!arg.empty() && arg[0] != '-') { options.files_to_open.push_back(arg); }
    }

    return options;
}

} // namespace ods

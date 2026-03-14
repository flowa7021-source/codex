#pragma once

#include "reading_settings.h"
#include "view_mode.h"

#include <optional>
#include <string>
#include <vector>

namespace ods {

struct CliOptions {
    std::vector<std::string> files_to_open;
    std::optional<int> page;
    std::optional<std::string> find_query;
    std::optional<ViewMode> view_mode;
    std::optional<int> rotate_degrees;
    std::optional<std::size_t> delete_page;
    std::optional<std::size_t> crop_page;
    std::optional<std::string> print_range;
    std::optional<std::string> command_palette_query;
    std::optional<std::string> import_folder;
    std::optional<std::string> pin_path;
    std::optional<std::string> unpin_path;
    std::optional<std::string> script_file;
    std::optional<std::string> export_hotkeys_path;
    std::optional<std::string> import_hotkeys_path;
    std::optional<std::string> theme;
    std::optional<FitMode> fit_mode;
    std::optional<int> zoom_percent;
    bool interactive = false;
    bool show_version = false;
    bool show_help = false;
    bool doctor = false;
    bool init_layout = false;
    bool list_library = false;
    bool nav_back = false;
    bool nav_forward = false;
    bool print_without_annotations = false;
    bool show_hotkeys_sheet = false;
    bool show_pages_overview = false;
    bool run_ocr_page = false;
    bool copy_selection_as_image = false;
    bool hide_annotations = false;

    static CliOptions Parse(int argc, char** argv);
};

} // namespace ods

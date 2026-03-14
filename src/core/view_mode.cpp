#include "view_mode.h"

namespace ods {

std::optional<ViewMode> ParseViewMode(const std::string& value) {
    if (value == "single") return ViewMode::Single;
    if (value == "continuous") return ViewMode::Continuous;
    if (value == "overview") return ViewMode::Overview;
    if (value == "double") return ViewMode::DoublePage;
    if (value == "book") return ViewMode::Book;
    if (value == "booklet") return ViewMode::Booklet;
    if (value == "slideshow") return ViewMode::SlideShow;
    if (value == "fullscreen") return ViewMode::Fullscreen;
    return std::nullopt;
}

std::string ToString(ViewMode mode) {
    switch (mode) {
        case ViewMode::Single: return "single";
        case ViewMode::Continuous: return "continuous";
        case ViewMode::Overview: return "overview";
        case ViewMode::DoublePage: return "double";
        case ViewMode::Book: return "book";
        case ViewMode::Booklet: return "booklet";
        case ViewMode::SlideShow: return "slideshow";
        case ViewMode::Fullscreen: return "fullscreen";
    }
    return "single";
}

} // namespace ods

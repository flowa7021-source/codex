#pragma once

#include <optional>
#include <string>

namespace ods {

enum class ViewMode {
    Single,
    Continuous,
    Overview,
    DoublePage,
    Book,
    Booklet,
    SlideShow,
    Fullscreen
};

std::optional<ViewMode> ParseViewMode(const std::string& value);
std::string ToString(ViewMode mode);

} // namespace ods

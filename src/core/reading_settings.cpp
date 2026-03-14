#include "reading_settings.h"

namespace ods {

std::optional<FitMode> ParseFitMode(const std::string& value) {
    if (value == "page") return FitMode::FitPage;
    if (value == "width") return FitMode::FitWidth;
    if (value == "height") return FitMode::FitHeight;
    if (value == "minside") return FitMode::FitMinSide;
    if (value == "actual") return FitMode::ActualSize;
    return std::nullopt;
}

std::string ToString(FitMode mode) {
    switch (mode) {
        case FitMode::FitPage: return "page";
        case FitMode::FitWidth: return "width";
        case FitMode::FitHeight: return "height";
        case FitMode::FitMinSide: return "minside";
        case FitMode::ActualSize: return "actual";
    }
    return "page";
}

} // namespace ods

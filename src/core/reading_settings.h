#pragma once

#include <optional>
#include <string>

namespace ods {

enum class FitMode {
    FitPage,
    FitWidth,
    FitHeight,
    FitMinSide,
    ActualSize
};

struct ReadingSettings {
    std::string theme = "light";
    FitMode fit_mode = FitMode::FitPage;
    int zoom_percent = 100;
};

std::optional<FitMode> ParseFitMode(const std::string& value);
std::string ToString(FitMode mode);

} // namespace ods

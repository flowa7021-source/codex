#pragma once

#include <optional>
#include <string>
#include <vector>

namespace ods {

enum class Command {
    Open,
    Find,
    OcrPage,
    Screenshot,
    ToggleAnnotations,
    Overview,
    Rotate90,
    CropPage,
    DeletePage
};

std::vector<std::string> CommandCatalog();
std::optional<Command> ResolveCommand(const std::string& text);

} // namespace ods

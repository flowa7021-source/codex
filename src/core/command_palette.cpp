#include "command_palette.h"

#include <algorithm>
#include <cctype>

namespace ods {

static std::string Normalize(const std::string& text) {
    std::string s;
    s.reserve(text.size());
    for (const char c : text) {
        s.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    }
    return s;
}

std::vector<std::string> CommandCatalog() {
    return {
        "open", "find", "ocr page", "screenshot", "toggle annotations",
        "pages overview", "rotate 90", "crop page", "delete page"
    };
}

std::optional<Command> ResolveCommand(const std::string& text) {
    const std::string key = Normalize(text);

    if (key == "open") return Command::Open;
    if (key == "find") return Command::Find;
    if (key == "ocr" || key == "ocr page") return Command::OcrPage;
    if (key == "screenshot" || key == "snapshot") return Command::Screenshot;
    if (key == "toggle annotations" || key == "hide annotations") return Command::ToggleAnnotations;
    if (key == "overview" || key == "pages overview") return Command::Overview;
    if (key == "rotate" || key == "rotate 90") return Command::Rotate90;
    if (key == "crop" || key == "crop page") return Command::CropPage;
    if (key == "delete" || key == "delete page") return Command::DeletePage;

    return std::nullopt;
}

} // namespace ods

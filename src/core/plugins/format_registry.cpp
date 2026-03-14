#include "format_registry.h"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <sstream>

namespace ods {

std::string FormatRegistry::Extension(const std::string& path) {
    const auto dot = path.find_last_of('.');
    if (dot == std::string::npos) {
        return {};
    }
    std::string ext = path.substr(dot + 1);
    std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return ext;
}

std::vector<std::string> FormatRegistry::SupportedFormats() const {
    return {"pdf", "djvu", "djv", "cbz", "epub"};
}

bool FormatRegistry::Supports(const std::string& path) const {
    const auto ext = Extension(path);
    const auto formats = SupportedFormats();
    return std::find(formats.begin(), formats.end(), ext) != formats.end();
}

std::optional<DocumentModel> FormatRegistry::Open(const std::string& path) const {
    if (!Supports(path)) {
        return std::nullopt;
    }

    std::ifstream input(path, std::ios::binary);
    if (!input.is_open()) {
        return DocumentModel{path, Extension(path), {PageData{"[placeholder] file missing in dev environment", 0, false}}};
    }

    std::ostringstream content;
    content << input.rdbuf();
    const std::string raw = content.str();

    std::vector<PageData> pages;
    std::string current;
    for (char c : raw) {
        if (c == '\f') {
            pages.push_back(PageData{current, 0, false});
            current.clear();
        } else {
            current.push_back(c);
        }
    }
    if (!current.empty() || pages.empty()) {
        pages.push_back(PageData{current.empty() ? "[binary page]" : current, 0, false});
    }

    return DocumentModel{path, Extension(path), pages};
}

} // namespace ods

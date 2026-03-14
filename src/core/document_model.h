#pragma once

#include <string>
#include <vector>

namespace ods {

struct PageData {
    std::string content;
    int rotation_degrees = 0;
    bool cropped = false;
};

struct DocumentModel {
    std::string path;
    std::string format;
    std::vector<PageData> pages;

    [[nodiscard]] std::size_t PageCount() const { return pages.size(); }
    [[nodiscard]] bool IsImageLike() const { return format == "cbz" || format == "djvu" || format == "djv"; }
};

} // namespace ods

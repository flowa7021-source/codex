#include "document_session.h"

namespace ods {

void DocumentSession::OpenTab(DocumentModel document, int page) {
    tabs_.push_back(DocumentTab{std::move(document), page, ViewMode::Single});
}

bool DocumentSession::SetViewMode(ViewMode mode) {
    if (tabs_.empty()) {
        return false;
    }
    tabs_.back().view_mode = mode;
    return true;
}

bool DocumentSession::RotatePage(std::size_t page_index, int degrees) {
    if (tabs_.empty() || page_index >= tabs_.back().document.pages.size()) {
        return false;
    }
    auto& page = tabs_.back().document.pages[page_index];
    page.rotation_degrees = (page.rotation_degrees + degrees) % 360;
    if (page.rotation_degrees < 0) {
        page.rotation_degrees += 360;
    }
    return true;
}

bool DocumentSession::DeletePage(std::size_t page_index) {
    if (tabs_.empty() || page_index >= tabs_.back().document.pages.size()) {
        return false;
    }

    auto& pages = tabs_.back().document.pages;
    pages.erase(pages.begin() + static_cast<long>(page_index));
    if (pages.empty()) {
        pages.push_back(PageData{"[empty]", 0, false});
    }
    return true;
}

bool DocumentSession::CropPage(std::size_t page_index) {
    if (tabs_.empty() || page_index >= tabs_.back().document.pages.size()) {
        return false;
    }
    tabs_.back().document.pages[page_index].cropped = true;
    return true;
}

std::optional<std::size_t> DocumentSession::SearchFirst(const std::string& query) const {
    if (tabs_.empty()) {
        return std::nullopt;
    }

    const auto& pages = tabs_.back().document.pages;
    for (std::size_t i = 0; i < pages.size(); ++i) {
        if (pages[i].content.find(query) != std::string::npos) {
            return i + 1;
        }
    }
    return std::nullopt;
}

const std::vector<DocumentTab>& DocumentSession::Tabs() const {
    return tabs_;
}

std::vector<DocumentTab>& DocumentSession::Tabs() {
    return tabs_;
}

} // namespace ods

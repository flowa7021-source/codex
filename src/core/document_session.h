#pragma once

#include "document_model.h"
#include "view_mode.h"

#include <optional>
#include <string>
#include <vector>

namespace ods {

struct DocumentTab {
    DocumentModel document;
    int current_page = 1;
    ViewMode view_mode = ViewMode::Single;
};

class DocumentSession {
public:
    void OpenTab(DocumentModel document, int page = 1);
    bool SetViewMode(ViewMode mode);
    bool RotatePage(std::size_t page_index, int degrees);
    bool DeletePage(std::size_t page_index);
    bool CropPage(std::size_t page_index);
    std::optional<std::size_t> SearchFirst(const std::string& query) const;
    const std::vector<DocumentTab>& Tabs() const;
    std::vector<DocumentTab>& Tabs();

private:
    std::vector<DocumentTab> tabs_;
};

} // namespace ods

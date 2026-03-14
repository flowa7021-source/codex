#include "navigation_history.h"

namespace ods {

void NavigationHistory::Visit(int page) {
    if (index_ >= 0 && index_ < static_cast<int>(items_.size()) && items_[index_] == page) {
        return;
    }

    if (index_ + 1 < static_cast<int>(items_.size())) {
        items_.erase(items_.begin() + index_ + 1, items_.end());
    }
    items_.push_back(page);
    index_ = static_cast<int>(items_.size()) - 1;
}

std::optional<int> NavigationHistory::Back() {
    if (index_ <= 0) {
        return std::nullopt;
    }
    --index_;
    return items_[index_];
}

std::optional<int> NavigationHistory::Forward() {
    if (index_ < 0 || index_ + 1 >= static_cast<int>(items_.size())) {
        return std::nullopt;
    }
    ++index_;
    return items_[index_];
}

std::optional<int> NavigationHistory::Current() const {
    if (index_ < 0 || index_ >= static_cast<int>(items_.size())) {
        return std::nullopt;
    }
    return items_[index_];
}

} // namespace ods

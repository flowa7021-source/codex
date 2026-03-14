#pragma once

#include <optional>
#include <vector>

namespace ods {

class NavigationHistory {
public:
    void Visit(int page);
    std::optional<int> Back();
    std::optional<int> Forward();
    [[nodiscard]] std::optional<int> Current() const;

private:
    std::vector<int> items_;
    int index_ = -1;
};

} // namespace ods

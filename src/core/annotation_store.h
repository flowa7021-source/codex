#pragma once

#include <string>
#include <vector>

namespace ods {

struct Annotation {
    int id = 0;
    int page = 1;
    std::string kind;
    std::string text;
    bool hidden = false;
    bool locked = false;
};

class AnnotationStore {
public:
    int Add(int page, const std::string& kind, const std::string& text);
    bool ToggleHidden(int id);
    bool ToggleLocked(int id);
    std::vector<Annotation> List(bool include_hidden) const;

private:
    int next_id_ = 1;
    std::vector<Annotation> annotations_;
};

} // namespace ods

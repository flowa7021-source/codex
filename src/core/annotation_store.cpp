#include "annotation_store.h"

namespace ods {

int AnnotationStore::Add(int page, const std::string& kind, const std::string& text) {
    annotations_.push_back(Annotation{next_id_, page, kind, text, false, false});
    return next_id_++;
}

bool AnnotationStore::ToggleHidden(int id) {
    for (auto& item : annotations_) {
        if (item.id == id) {
            item.hidden = !item.hidden;
            return true;
        }
    }
    return false;
}

bool AnnotationStore::ToggleLocked(int id) {
    for (auto& item : annotations_) {
        if (item.id == id) {
            item.locked = !item.locked;
            return true;
        }
    }
    return false;
}

std::vector<Annotation> AnnotationStore::List(bool include_hidden) const {
    if (include_hidden) {
        return annotations_;
    }

    std::vector<Annotation> visible;
    for (const auto& item : annotations_) {
        if (!item.hidden) {
            visible.push_back(item);
        }
    }
    return visible;
}

} // namespace ods

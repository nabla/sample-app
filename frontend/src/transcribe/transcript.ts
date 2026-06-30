import type { TranscriptItem } from "../api/transcribe.js";

// Accumulates transcript items for a whole session — across however many streams a
// pause/restart opens — deduped by id, so a re-sent final overwrites its partial.
export class Transcript {
  private itemsById = new Map<string, TranscriptItem>();

  add(item: TranscriptItem): void {
    this.itemsById.set(item.id, item);
  }

  // Unique items, sorted by start time (items aren't guaranteed to arrive in order).
  items(): TranscriptItem[] {
    return [...this.itemsById.values()].sort(
      (left, right) => left.start_offset_ms - right.start_offset_ms,
    );
  }

  clear(): void {
    this.itemsById.clear();
  }
}

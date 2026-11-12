import { describe, expect, it } from "vitest";
import { organize } from "./clusterer";
import { checkDistress } from "./distress";
import { queue, review } from "./recall";

describe("organize", () => {
  it("groups notes sharing a word", () => {
    const r = organize([
      { id: "1", text: "buy groceries milk" }, { id: "2", text: "groceries for the party" },
      { id: "3", text: "project deadline friday" }, { id: "4", text: "project review notes" },
    ]);
    expect(r.clusters).toHaveLength(2);
    expect(r.clusters[0]!.label).toBe("Grocery");
    expect(r.clusters[1]!.label).toBe("Project");
  });
});
describe("big palaces", () => {
  it("a word in most notes does not merge everything", () => {
    const topics = ["exam", "garden", "music", "budget"];
    const notes = Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: `idea about ${topics[i % 4]} ${i}` }));
    expect(organize(notes).clusters).toHaveLength(4);
  });
});
describe("reframe", () => {
  it("offers a kinder view for harsh self-talk", () => {
    const r = organize([{ id: "1", text: "I always quit things" }, { id: "2", text: "quit sugar" }]);
    expect(r.suggestions.find((x) => x.kind === "reframe")?.noteId).toBe("1");
  });
});
describe("distress gate", () => {
  it("flags crisis language", () => expect(checkDistress("I want to end it all")).toBe(true));
  it("ignores ordinary notes", () => expect(checkDistress("kill the bug in checkout")).toBe(false));
});
describe("spaced repetition", () => {
  it("correct answer moves to 1-day interval", () => {
    const n = review({ box: 0, dueAt: 0 }, true, 0);
    expect(n.box).toBe(1); expect(n.dueAt).toBe(86_400_000);
  });
  it("miss resets to box 0, due in 10 minutes", () => {
    expect(review({ box: 3, dueAt: 0 }, false, 0)).toEqual({ box: 0, dueAt: 600_000 });
  });
  it("weakest first", () => {
    expect(queue([{ box: 2, dueAt: 0 }, { box: 0, dueAt: 5 }], 10)[0]!.box).toBe(0);
  });
});

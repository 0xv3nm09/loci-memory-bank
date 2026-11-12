export type Mode = "think" | "grow" | "imagine";
export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "think", label: "Think", hint: "Untangle what's on your mind" },
  { id: "grow", label: "Grow", hint: "Turn goals into steps" },
  { id: "imagine", label: "Imagine", hint: "Let ideas wander" },
];
export const SEEDS: Record<Mode, { title: string; notes: string[] }[]> = {
  think: [
    { title: "A busy week", notes: ["Project deadline is Friday", "Review the project budget", "Call mom this weekend", "Weekend trip with mom", "Groceries for the party", "Party playlist", "Sleep earlier this week"] },
    { title: "Learning Spanish", notes: ["Spanish verbs are hard", "Practice Spanish daily for 10 minutes", "Watch a movie in Spanish", "Flashcards for Spanish verbs", "Find a speaking partner"] },
  ],
  grow: [
    { title: "Run a 10k", notes: ["Goal: run a 10k by spring", "Run three times a week", "Buy proper running shoes", "Stretch after every run", "Track run distance weekly"] },
    { title: "Ship a side project", notes: ["Pick one project idea", "Project scope: one core feature", "Ship the first version in two weeks", "Ask five friends for feedback", "Write a launch post"] },
  ],
  imagine: [
    { title: "A floating city", notes: ["A city floating above the clouds", "City gardens hang from bridges", "Wind powers the whole city", "Travellers arrive by kite", "The clouds below remember stories"] },
    { title: "A story seed", notes: ["A lighthouse keeper who collects lost letters", "Each letter opens a door", "The lighthouse never sleeps", "A letter arrives addressed to the keeper"] },
  ],
};

export const SAGE: Record<Mode, { hello: string; capture: string[]; snap: string[]; switch: string }> = {
  think: { hello: "What's on your mind?", capture: ["Got it.", "Okay, let's untangle this.", "Keep going — I'm listening."], snap: ["Here's how I see it…", "These keep showing up together — coincidence?", "These feel like one idea."], switch: "Okay, let's untangle this." },
  grow: { hello: "What do you want to work toward?", capture: ["Noted.", "That's a good one to hold onto.", "Small steps count."], snap: ["Here's your path so far.", "Look how much good stuff is in this corner already."], switch: "What are we growing today?" },
  imagine: { hello: "Tell me about a world.", capture: ["Ooh, tell me more.", "This world's getting good.", "And then what happens?"], snap: ["Here's the map of your world.", "What if the villain isn't the villain?"], switch: "Ooh, where are we going today?" },
};
export const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

import { defineComponents } from '@iwsdk/core';
import {
  AnswerCard,
  ClusterLabel,
  ConnectionLine,
  Note,
  OrganizeOrb,
  QuizDone,
  RecallOrb,
  SeedCard,
  SnapAnimation,
  SuggestionBud,
} from './loci/components.js';

export default defineComponents([
  Note,
  SnapAnimation,
  ConnectionLine,
  SeedCard,
  OrganizeOrb,
  ClusterLabel,
  RecallOrb,
  AnswerCard,
  QuizDone,
  SuggestionBud,
]);

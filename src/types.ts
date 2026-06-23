export interface Subheading {
  id: string;
  text: string;
  description?: string;
}

export interface LearningCard {
  id: string;
  heading: string;
  subheadings: Subheading[];
  techStack: string[];
  date: string;
}

export interface LearningSet {
  id: string;
  title: string;
  description: string;
  cards: LearningCard[];
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  sets: LearningSet[];
}

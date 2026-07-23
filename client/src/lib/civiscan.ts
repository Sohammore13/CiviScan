export type Category = "Safe" | "Toxic" | "Offensive" | "Cyberbullying";

export interface CommentData {
  id: string;
  text: string;
  author: string;
  likes: number;
  category: Category;
  score: number;
}

export interface AnalysisResult {
  counts: Record<Category, number>;
  total: number;
  comments: CommentData[];
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Safe: "#10B981",
  Toxic: "#F59E0B",
  Offensive: "#6366F1",
  Cyberbullying: "#EF4444",
};
/**
 * Hand-maintained types for the Supabase schema in supabase/migrations.
 * Regenerate with `supabase gen types typescript --local` once a local stack is available,
 * and keep this file in sync with any migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EducationLevel =
  | "high_school"
  | "diploma"
  | "undergraduate"
  | "postgraduate"
  | "bootcamp"
  | "self_taught"
  | "other";
export type ExperienceLevel = "none" | "beginner" | "intermediate" | "advanced";
export type LearningPace = "relaxed" | "steady" | "intensive";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type AssessmentKind = "initial" | "follow_up";
export type AttemptStatus = "in_progress" | "submitted" | "abandoned";
export type SkillEvidenceStatus = "assessed" | "insufficient_evidence" | "not_assessed";
export type SkillSource = "initial_assessment" | "follow_up_assessment";
export type RoadmapStatus = "active" | "completed" | "archived";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "needs_review";
export type TaskType = "learn" | "practice" | "project" | "assessment";
export type MessageRole = "user" | "assistant";

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type CareerRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  responsibilities: string[];
  prerequisites: string[];
  suggested_projects: Json;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type SkillRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  resources: Json;
  created_at: string;
};

export type CareerSkillRow = {
  id: string;
  career_id: string;
  skill_id: string;
  required_proficiency: number;
  importance_weight: number;
  created_at: string;
};

export type SkillDependencyRow = { id: string; prerequisite_skill_id: string; dependent_skill_id: string };

export type AssessmentQuestionRow = {
  id: string;
  key: string;
  skill_id: string;
  question_text: string;
  options: Json;
  correct_option_index: number;
  explanation: string;
  difficulty: DifficultyLevel;
  points: number;
  time_limit_seconds: number | null;
  is_active: boolean;
  created_at: string;
};

export type PracticalChallengeRow = {
  id: string;
  key: string;
  skill_id: string;
  title: string;
  instructions: string;
  expected_output: string;
  difficulty: DifficultyLevel;
  evaluation_rubric: Json;
  maximum_points: number;
  is_active: boolean;
  created_at: string;
};

export type LearningTaskTemplateRow = {
  id: string;
  key: string;
  skill_id: string;
  level: number;
  task_type: TaskType;
  title: string;
  description: string;
  estimated_minutes: number;
  completion_criteria: string;
  resource_url: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  education_level: EducationLevel | null;
  institution: string | null;
  graduation_year: number | null;
  interests: string[];
  current_skills: string[];
  experience_level: ExperienceLevel | null;
  target_career_id: string | null;
  weekly_learning_hours: number | null;
  learning_pace: LearningPace | null;
  learning_goals: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type AssessmentAttemptRow = {
  id: string;
  user_id: string;
  career_id: string;
  kind: AssessmentKind;
  status: AttemptStatus;
  question_ids: string[];
  challenge_ids: string[];
  draft_answers: Json;
  draft_practicals: Json;
  started_at: string;
  submitted_at: string | null;
  mcq_earned_points: number | null;
  mcq_available_points: number | null;
  practical_earned_points: number | null;
  practical_available_points: number | null;
  total_score: number | null;
  violation_count: number;
  violations: Json;
  auto_submitted: boolean;
  created_at: string;
};

export type AssessmentResponseRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_index: number | null;
  is_correct: boolean;
  awarded_points: number;
  max_points: number;
  response_metadata: Json;
  created_at: string;
};

export type PracticalSubmissionRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  attempt_id: string;
  submission_content: string;
  attempted: boolean;
  awarded_points: number;
  max_points: number;
  feedback: Json;
  submitted_at: string;
};

export type AttemptSkillScoreRow = {
  id: string;
  attempt_id: string;
  skill_id: string;
  mcq_earned_points: number;
  mcq_available_points: number;
  mcq_question_count: number;
  practical_earned_points: number | null;
  practical_available_points: number | null;
  mcq_score: number | null;
  practical_score: number | null;
  proficiency: number | null;
  status: SkillEvidenceStatus;
};

export type UserSkillLevelRow = {
  id: string;
  user_id: string;
  skill_id: string;
  current_proficiency: number;
  assessment_status: SkillEvidenceStatus;
  source_attempt_id: string | null;
  updated_at: string;
};

export type SkillHistoryRow = {
  id: string;
  user_id: string;
  skill_id: string;
  proficiency: number;
  source_type: SkillSource;
  source_id: string;
  recorded_at: string;
};

export type RoadmapRow = {
  id: string;
  user_id: string;
  career_id: string;
  title: string;
  duration_weeks: number;
  status: RoadmapStatus;
  weekly_minutes_budget: number;
  learning_pace: LearningPace;
  generated_from_attempt_id: string | null;
  generation_notes: Json;
  created_at: string;
  updated_at: string;
};

export type RoadmapWeekRow = {
  id: string;
  roadmap_id: string;
  week_number: number;
  title: string;
  objective: string;
  completion_criterion: string;
  focus_skill_ids: string[];
};

export type LearningTaskRow = {
  id: string;
  roadmap_id: string;
  roadmap_week_id: string;
  user_id: string;
  template_id: string | null;
  skill_id: string | null;
  task_type: TaskType;
  title: string;
  description: string;
  estimated_minutes: number;
  completion_criteria: string;
  resource_url: string | null;
  sort_order: number;
  depends_on_task_ids: string[];
  is_stretch: boolean;
  status: TaskStatus;
  started_at: string | null;
  completed_at: string | null;
  actual_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  context_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      careers: Table<CareerRow, "slug" | "name" | "description">;
      skills: Table<SkillRow, "slug" | "name" | "description" | "category">;
      career_skills: Table<CareerSkillRow, "career_id" | "skill_id" | "required_proficiency">;
      skill_dependencies: Table<SkillDependencyRow, "prerequisite_skill_id" | "dependent_skill_id">;
      assessment_questions: Table<AssessmentQuestionRow, "key" | "skill_id" | "question_text" | "options" | "correct_option_index" | "explanation" | "difficulty">;
      practical_challenges: Table<PracticalChallengeRow, "key" | "skill_id" | "title" | "instructions" | "expected_output" | "difficulty" | "evaluation_rubric" | "maximum_points">;
      learning_task_templates: Table<LearningTaskTemplateRow, "key" | "skill_id" | "level" | "task_type" | "title" | "description" | "estimated_minutes" | "completion_criteria">;
      profiles: Table<ProfileRow, "id">;
      assessment_attempts: Table<AssessmentAttemptRow, "user_id" | "career_id" | "question_ids">;
      assessment_responses: Table<AssessmentResponseRow, "attempt_id" | "question_id" | "is_correct" | "awarded_points" | "max_points">;
      practical_submissions: Table<PracticalSubmissionRow, "user_id" | "challenge_id" | "attempt_id" | "submission_content" | "attempted" | "awarded_points" | "max_points">;
      attempt_skill_scores: Table<AttemptSkillScoreRow, "attempt_id" | "skill_id" | "status">;
      user_skill_levels: Table<UserSkillLevelRow, "user_id" | "skill_id" | "current_proficiency">;
      skill_history: Table<SkillHistoryRow, "user_id" | "skill_id" | "proficiency" | "source_type" | "source_id">;
      roadmaps: Table<RoadmapRow, "user_id" | "career_id" | "title" | "weekly_minutes_budget" | "learning_pace">;
      roadmap_weeks: Table<RoadmapWeekRow, "roadmap_id" | "week_number" | "title" | "objective" | "completion_criterion">;
      learning_tasks: Table<LearningTaskRow, "roadmap_id" | "roadmap_week_id" | "user_id" | "task_type" | "title" | "description" | "estimated_minutes" | "completion_criteria">;
      conversations: Table<ConversationRow, "user_id">;
      messages: Table<MessageRow, "conversation_id" | "user_id" | "role" | "content">;
    };
    Views: { [_ in never]: never };
    Functions: {
      finalize_assessment: {
        Args: { p_attempt_id: string; p_user_id: string; p_result: Json };
        Returns: undefined;
      };
      record_assessment_violation: {
        Args: { p_attempt_id: string; p_user_id: string; p_type: string };
        Returns: number;
      };
      replace_active_roadmap: {
        Args: { p_user_id: string; p_plan: Json };
        Returns: string;
      };
    };
    Enums: {
      education_level: EducationLevel;
      experience_level: ExperienceLevel;
      learning_pace: LearningPace;
      difficulty_level: DifficultyLevel;
      assessment_kind: AssessmentKind;
      attempt_status: AttemptStatus;
      skill_evidence_status: SkillEvidenceStatus;
      skill_source: SkillSource;
      roadmap_status: RoadmapStatus;
      task_status: TaskStatus;
      task_type: TaskType;
      message_role: MessageRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

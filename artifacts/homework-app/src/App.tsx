import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme-provider";
import { DarkModeProvider } from "@/lib/dark-mode";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ErrorBoundary } from "@/components/error-boundary";
import { GlobalAiAssistant } from "@/components/ai-assistant";
import { PageViewTracker } from "@/components/page-view-tracker";
import { HeartbeatTracker } from "@/components/heartbeat-tracker";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const Home = lazy(() => import("@/pages/home"));
const Auth = lazy(() => import("@/pages/auth"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const VerifyAccount = lazy(() => import("@/pages/verify-account"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
const TeacherDashboard = lazy(() => import("@/pages/teacher/dashboard"));
const OrganizerDashboard = lazy(() => import("@/pages/organizer/dashboard"));
const CreateAssignment = lazy(() => import("@/pages/teacher/create-assignment"));
const NewActivity = lazy(() => import("@/pages/teacher/new-activity"));
const PaperGradingCreate = lazy(() => import("@/pages/teacher/paper-grading-create"));
const DictationCreate = lazy(() => import("@/pages/teacher/dictation-create"));
const TeacherAssignmentDetail = lazy(() => import("@/pages/teacher/assignment-detail"));
const IslamicHome = lazy(() => import("@/pages/islamic/index"));
const IslamicPlay = lazy(() => import("@/pages/islamic/play"));
const IslamicAdmin = lazy(() => import("@/pages/islamic/admin"));
const IslamicLeaderboard = lazy(() => import("@/pages/islamic/leaderboard"));
const IslamicCertificate = lazy(() => import("@/pages/islamic/certificate"));
const IslamicChallengeNew = lazy(() => import("@/pages/islamic/challenge").then((m) => ({ default: m.IslamicChallengeNew })));
const IslamicChallengeJoin = lazy(() => import("@/pages/islamic/challenge").then((m) => ({ default: m.IslamicChallengeJoin })));
const IslamicChallengePlay = lazy(() => import("@/pages/islamic/challenge").then((m) => ({ default: m.IslamicChallengePlay })));
const IslamicTournamentPlay = lazy(() => import("@/pages/islamic/challenge").then((m) => ({ default: m.IslamicTournamentPlay })));
const IslamicTournamentHost = lazy(() => import("@/pages/islamic/challenge").then((m) => ({ default: m.IslamicTournamentHost })));
const StudentSolve = lazy(() => import("@/pages/student/solve"));
const GameJoin = lazy(() => import("@/pages/game/join"));
const GamePlay = lazy(() => import("@/pages/game/play"));
const TeacherGame = lazy(() => import("@/pages/game/teacher"));
const StudentsPage = lazy(() => import("@/pages/teacher/students"));
const TeacherLibraryPage = lazy(() => import("@/pages/teacher/library"));
const NotFound = lazy(() => import("@/pages/not-found"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const FaqPage = lazy(() => import("@/pages/faq"));
const AboutPage = lazy(() => import("@/pages/about"));
const TeacherProfile = lazy(() => import("@/pages/teacher/profile"));
const TeacherSettings = lazy(() => import("@/pages/teacher/settings"));
const TeacherAchievements = lazy(() => import("@/pages/teacher/achievements"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));
const TeacherPublicProfile = lazy(() => import("@/pages/teacher-public-profile"));
const StudentPublicProfile = lazy(() => import("@/pages/student-public-profile"));
const TeacherGamesPage = lazy(() => import("@/pages/teacher/games"));
const TeacherSessions = lazy(() => import("@/pages/teacher/sessions"));
const AdminPage = lazy(() => import("@/pages/teacher/admin"));
const AdminHiddenPage = lazy(() => import("@/pages/admin/hidden"));
const ArenaReportsPage = lazy(() => import("@/pages/teacher/arena-reports"));
const ArenaContentAdmin = lazy(() => import("@/pages/teacher/arena-content"));
const TeacherIslamicAdmin = lazy(() => import("@/pages/teacher/islamic-admin"));
const QuestionBankPage = lazy(() => import("@/pages/teacher/question-bank"));
const WhiteboardMonitor = lazy(() => import("@/pages/teacher/whiteboard-monitor"));
const SharedContentPage = lazy(() => import("@/pages/teacher/shared-content"));
const CategoriesPage = lazy(() => import("@/pages/teacher/categories"));
const CollectionsPage = lazy(() => import("@/pages/teacher/collections"));
const ClassGrades = lazy(() => import("@/pages/teacher/class-grades"));
const PresentationsIndex = lazy(() => import("@/pages/teacher/presentations/index"));
const NewPresentation = lazy(() => import("@/pages/teacher/presentations/new"));
const PresentationDrafts = lazy(() => import("@/pages/teacher/presentations/drafts"));
const PresentationEditor = lazy(() => import("@/pages/teacher/presentations/editor"));
const PresentationPresent = lazy(() => import("@/pages/teacher/presentations/present"));
const PresentationPrint = lazy(() => import("@/pages/teacher/presentations/print"));
const PublicPresent = lazy(() => import("@/pages/p/[id]"));
const PresentationControl = lazy(() => import("@/pages/p/control"));
const PresentationShow = lazy(() => import("@/pages/p/show"));
const PresentationJoin = lazy(() => import("@/pages/p/join"));
const PresentationPlay = lazy(() => import("@/pages/p/play"));
const PresentationResults = lazy(() => import("@/pages/p/results"));
const StudentInsights = lazy(() => import("@/pages/p/student-insights"));
const StudentTimeline = lazy(() => import("@/pages/p/student-timeline"));
const PresentationSessionsHistory = lazy(() => import("@/pages/teacher/presentations/sessions"));
const PresentationCompare = lazy(() => import("@/pages/teacher/presentations/compare"));
const PresentationActivityRunner = lazy(() => import("@/pages/teacher/presentations/activity-runner"));
const CreateVideoLesson = lazy(() => import("@/pages/teacher/create-video-lesson"));
const VideoLessonDetail = lazy(() => import("@/pages/teacher/video-lesson-detail"));
const StudentVideoLesson = lazy(() => import("@/pages/student/video-lesson"));
const AdaptiveSolve = lazy(() => import("@/pages/student/adaptive-solve"));
const SmartBoardAsk     = lazy(() => import("@/pages/teacher/smart-board-ask"));
const SmartBoard        = lazy(() => import("@/pages/teacher/smart-board"));
const SmartBoardNew     = lazy(() => import("@/pages/teacher/smart-board-new"));
const SmartBoardEdit    = lazy(() => import("@/pages/teacher/smart-board-edit"));
const SmartBoardPresent = lazy(() => import("@/pages/teacher/smart-board-present"));
const SmartBoardHistory = lazy(() => import("@/pages/teacher/smart-board-history"));
const PublicGamesPage = lazy(() => import("@/pages/public-games"));
const GuestCreatePage = lazy(() => import("@/pages/guest-create"));
const SoloPlayPage = lazy(() => import("@/pages/solo-play"));
const TugCreate = lazy(() => import("@/pages/game/tug-create"));
const TugJoin = lazy(() => import("@/pages/game/tug-join"));
const TugPlay = lazy(() => import("@/pages/game/tug-play"));
const TugClass = lazy(() => import("@/pages/game/tug-class"));
const EscapeCreate = lazy(() => import("@/pages/game/escape-create"));
const EscapeClass = lazy(() => import("@/pages/game/escape-class"));
const EscapeHost = lazy(() => import("@/pages/game/escape-host"));
const EscapePlay = lazy(() => import("@/pages/game/escape-play"));
const HotSeatCreate = lazy(() => import("@/pages/game/hotseat-create"));
const WameethCreate = lazy(() => import("@/pages/game/wameeth-create"));
const WameethClass  = lazy(() => import("@/pages/game/wameeth-class"));
const HotSeatHost = lazy(() => import("@/pages/game/hotseat-host"));
const HotSeatJoin = lazy(() => import("@/pages/game/hotseat-join"));
const HotSeatPlay = lazy(() => import("@/pages/game/hotseat-play"));
const RocketCreate = lazy(() => import("@/pages/game/rocket-create"));
const RocketJoin = lazy(() => import("@/pages/game/rocket-join"));
const RocketPlay = lazy(() => import("@/pages/game/rocket-play"));
const RocketHost = lazy(() => import("@/pages/game/rocket-host"));
const WheelCreate = lazy(() => import("@/pages/game/wheel-create"));
const WheelPlay = lazy(() => import("@/pages/game/wheel-play"));
const WorksheetCreate = lazy(() => import("@/pages/teacher/worksheet-create"));
const WorksheetPrint = lazy(() => import("@/pages/teacher/worksheet-print"));
const WorksheetGrade = lazy(() => import("@/pages/teacher/worksheet-grade"));
const WorksheetReport = lazy(() => import("@/pages/teacher/worksheet-report"));
const MindMapCreate = lazy(() => import("@/pages/teacher/mindmap-create"));
const LessonPlanCreate = lazy(() => import("@/pages/teacher/lesson-plan-create"));
const LessonPlanPrint = lazy(() => import("@/pages/teacher/lesson-plan-print"));
const FlagsSetup = lazy(() => import("@/pages/game/flags-setup"));
const FlagsPlay = lazy(() => import("@/pages/game/flags-play"));
const FlagsJoin = lazy(() => import("@/pages/game/flags-join"));
const FlagsMultiPlay = lazy(() => import("@/pages/game/flags-multi-play"));
const CapitalsSetup = lazy(() => import("@/pages/game/capitals-setup"));
const CapitalsPlay = lazy(() => import("@/pages/game/capitals-play"));
const CapitalsJoin = lazy(() => import("@/pages/game/capitals-join"));
const CapitalsMultiPlay = lazy(() => import("@/pages/game/capitals-multi-play"));
const ColorSetup = lazy(() => import("@/pages/game/color-setup"));
const ColorPlay = lazy(() => import("@/pages/game/color-play"));
const MemorySetup = lazy(() => import("@/pages/game/memory-setup"));
const MemoryPlay = lazy(() => import("@/pages/game/memory-play"));
const MemoryCreate = lazy(() => import("@/pages/game/memory-create"));
const MultiplySetup = lazy(() => import("@/pages/game/multiply-setup"));
const MultiplyPlay = lazy(() => import("@/pages/game/multiply-play"));
const LetrlySetup = lazy(() => import("@/pages/game/letrly-setup"));
const LetrlyPlay = lazy(() => import("@/pages/game/letrly-play"));
const LetrlyCreate = lazy(() => import("@/pages/game/letrly-create"));
const ScrambleSetup = lazy(() => import("@/pages/game/scramble-setup"));
const ScramblePlay = lazy(() => import("@/pages/game/scramble-play"));
const ScrambleCreate = lazy(() => import("@/pages/game/scramble-create"));
const ScrambleMonitor = lazy(() => import("@/pages/game/scramble-monitor"));
const VideoLive = lazy(() => import("@/pages/teacher/video-live"));
const StudentVideoLive = lazy(() => import("@/pages/student/video-live"));

const SmartBoardView = lazy(() => import("@/pages/student/smart-board-view"));
const StudentAuth = lazy(() => import("@/pages/student-auth"));
const StudentDashboard = lazy(() => import("@/pages/student/dashboard"));
const StroopSetup = lazy(() => import("@/pages/game/stroop-setup"));
const StroopPlay = lazy(() => import("@/pages/game/stroop-play"));
const StroopCreate = lazy(() => import("@/pages/game/stroop-create"));
const MaraquiSetup = lazy(() => import("@/pages/game/maraqui-setup"));
const MaraquiPlay = lazy(() => import("@/pages/game/maraqui-play"));
const MaraquiCreate = lazy(() => import("@/pages/game/maraqui-create"));
const MillionSetup = lazy(() => import("@/pages/game/million-setup"));
const MillionPlay = lazy(() => import("@/pages/game/million-play"));
const MillionClassHost = lazy(() => import("@/pages/game/million-class-host"));
const MillionJoin = lazy(() => import("@/pages/game/million-join"));
const MillionBroadcastHost = lazy(() => import("@/pages/game/million-broadcast-host"));
const MillionTeamControlHost = lazy(() => import("@/pages/game/million-team-control-host"));
const MillionTeamWatch = lazy(() => import("@/pages/game/million-team-watch"));
function LegacySharedRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/teacher/library/homework", { replace: true }); }, [setLocation]);
  return null;
}

function MillionTeamSetupRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/game/million", { replace: true }); }, [setLocation]);
  return null;
}
const HackSetup = lazy(() => import("@/pages/game/hack-setup"));
const HackShare = lazy(() => import("@/pages/game/hack-share"));
function HackJoinRedirect() {
  const params = useParams<{ pin?: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(params.pin ? `/game/join/${params.pin}` : "/game/join", { replace: true }); }, [params.pin, setLocation]);
  return null;
}
function HackPlayRedirect() {
  const params = useParams<{ pin: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(`/game/play/${params.pin}`, { replace: true }); }, [params.pin, setLocation]);
  return null;
}
const MillionTeamHost = lazy(() => import("@/pages/game/million-team-host"));
const MillionTeamPlay = lazy(() => import("@/pages/game/million-team-play"));
const GamesPage = lazy(() => import("@/pages/games"));
const ArenaSetup = lazy(() => import("@/pages/game/arena-setup"));
const ArenaPlay = lazy(() => import("@/pages/game/arena-play"));
const ArenaAudience = lazy(() => import("@/pages/game/arena-audience"));
const SecretSetup = lazy(() => import("@/pages/game/secret-setup"));
const SecretPlay = lazy(() => import("@/pages/game/secret-play"));
const SecretReveal = lazy(() => import("@/pages/game/secret-reveal"));
const PlaySecret = lazy(() => import("@/pages/game/play-secret"));
const PublicArenaSetup = lazy(() => import("@/pages/play/arena"));
const ClassroomPage = lazy(() => import("@/pages/teacher/classroom"));
const TeamsPage = lazy(() => import("@/pages/teacher/teams"));
const InstallTutorial = lazy(() => import("@/pages/install-tutorial"));
const InstallPage = lazy(() => import("@/pages/install"));
const SoloChallengesPage = lazy(() => import("@/pages/teacher/solo-challenges"));
const SoloChallengeCreate = lazy(() => import("@/pages/teacher/solo-challenge-create"));
const SoloChallengeManage = lazy(() => import("@/pages/teacher/solo-challenge-manage"));
const ParentMessagesPage = lazy(() => import("@/pages/teacher/parent-messages"));
const ParentPortalPage = lazy(() => import("@/pages/parent-portal"));

// Feature landing pages (SEO / public)
const FeatureWameeth        = lazy(() => import("@/pages/features/wameeth"));
const FeatureGames          = lazy(() => import("@/pages/features/games"));
const FeatureWorksheetAI    = lazy(() => import("@/pages/features/worksheet-ai"));
const FeaturePresentationsAI = lazy(() => import("@/pages/features/presentations-ai"));
const FeatureInteractiveVideo = lazy(() => import("@/pages/features/interactive-video"));
const FeatureSmartWhiteboard = lazy(() => import("@/pages/features/smart-whiteboard"));
const FeatureEscapeRoom     = lazy(() => import("@/pages/features/escape-room"));
const FeatureLessonPlanAI   = lazy(() => import("@/pages/features/lesson-plan-ai"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100svh", background: "#f7f6f2" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #0d6b75", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

/* Dark variant of the lazy-chunk fallback used by full-screen surfaces
   (present mode, public viewer, print preview). The default fallback is
   white-on-white, which made a slow-loading chunk look like a dead
   "white page" to teachers opening the present view in a new tab. */
function DarkLoadingFallback() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-amber-300 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// `/game/wameeth` is the legacy organizer entry point for the Wameedh live
// quiz. The dedicated setup page now lives at `/game/wameeth/create`, so we
// redirect there to keep any old links working.
function WameethRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/game/wameeth/create");
  }, [setLocation]);
  return <LoadingFallback />;
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Feature landing pages — public, no auth */}
        <Route path="/features/wameeth"          component={FeatureWameeth} />
        <Route path="/features/games"            component={FeatureGames} />
        <Route path="/features/worksheet-ai"     component={FeatureWorksheetAI} />
        <Route path="/features/presentations-ai" component={FeaturePresentationsAI} />
        <Route path="/features/interactive-video" component={FeatureInteractiveVideo} />
        <Route path="/features/smart-whiteboard" component={FeatureSmartWhiteboard} />
        <Route path="/features/escape-room"      component={FeatureEscapeRoom} />
        <Route path="/features/lesson-plan-ai"   component={FeatureLessonPlanAI} />

        <Route path="/" component={Home} />
        <Route path="/login" component={Auth} />
        <Route path="/register" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-account" component={VerifyAccount} />
        <Route path="/verify-email" component={VerifyEmail} />
        
        {/* Teacher Routes — most specific `/teacher/*` paths first; dashboard `/teacher` last */}
        {/* مسابقة ذاتية — standalone solo challenge management */}
        <Route path="/teacher/solo-challenges/new" component={SoloChallengeCreate} />
        <Route path="/teacher/solo-challenges/:slug" component={SoloChallengeManage} />
        <Route path="/teacher/solo-challenges" component={SoloChallengesPage} />
        <Route path="/teacher/new/assignment" component={CreateAssignment} />
        <Route path="/teacher/new/paper-grading" component={PaperGradingCreate} />
        <Route path="/teacher/new/dictation" component={DictationCreate} />
        <Route path="/teacher/new" component={NewActivity} />
        <Route path="/teacher/assignment/:id" component={TeacherAssignmentDetail} />
        <Route path="/islamic" component={IslamicHome} />
        <Route path="/islamic/admin" component={IslamicAdmin} />
        <Route path="/islamic/leaderboard" component={IslamicLeaderboard} />
        <Route path="/islamic/play/:categoryId" component={IslamicPlay} />
        <Route path="/islamic/certificate/:serial" component={IslamicCertificate} />
        <Route path="/islamic/challenge/new" component={IslamicChallengeNew} />
        <Route path="/islamic/challenge/join" component={IslamicChallengeJoin} />
        <Route path="/islamic/challenge/play/:pin" component={IslamicChallengePlay} />
        <Route path="/islamic/tournament/play/:pin" component={IslamicTournamentPlay} />
        <Route path="/islamic/tournament/host/:pin" component={IslamicTournamentHost} />
        <Route path="/teacher/classroom" component={ClassroomPage} />
        <Route path="/teacher/teams" component={TeamsPage} />
        <Route path="/teacher/students" component={StudentsPage} />
        <Route path="/teacher/library" component={TeacherLibraryPage} />
        <Route path="/teacher/profile" component={TeacherProfile} />
        <Route path="/teacher/settings" component={TeacherSettings} />
        <Route path="/teacher/achievements" component={TeacherAchievements} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/t/:idOrSlug" component={TeacherPublicProfile} />
        <Route path="/u/:idOrSlug" component={TeacherPublicProfile} />
        <Route path="/stu/:username" component={StudentPublicProfile} />
        <Route path="/teacher/games" component={TeacherGamesPage} />
        <Route path="/teacher/sessions" component={TeacherSessions} />
        <Route path="/teacher/admin" component={AdminPage} />
        <Route path="/admin/hidden" component={AdminHiddenPage} />
        <Route path="/teacher/arena-reports" component={ArenaReportsPage} />
        <Route path="/teacher/arena-content" component={ArenaContentAdmin} />
        <Route path="/teacher/islamic/admin" component={TeacherIslamicAdmin} />
        <Route path="/teacher/question-bank" component={QuestionBankPage} />
        <Route path="/teacher/game/:pin" component={TeacherGame} />
        <Route path="/teacher/whiteboard/:assignmentId/:questionId" component={WhiteboardMonitor} />
        {/* Legacy /teacher/shared → redirect to the new activities library
            (task #595 split). Existing bookmarks and links keep working. */}
        <Route path="/teacher/shared" component={LegacySharedRedirect} />
        {/* Split libraries — same component, kind comes from the URL */}
        {/* @ts-expect-error wouter RouteComponentProps mismatch — benign, component works at runtime */}
        <Route path="/teacher/library/homework" component={SharedContentPage} />
        {/* @ts-expect-error wouter RouteComponentProps mismatch — benign, component works at runtime */}
        <Route path="/teacher/library/competitions" component={SharedContentPage} />
        <Route path="/teacher/categories" component={CategoriesPage} />
        <Route path="/teacher/collections" component={CollectionsPage} />
        <Route path="/teacher/class-grades/:gradeLevel" component={ClassGrades} />
        {/* @ts-expect-error wouter RouteComponentProps mismatch — benign, component works at runtime */}
        <Route path="/teacher/presentations" component={PresentationsIndex} />
        <Route path="/teacher/presentations/new">
          <ErrorBoundary label="إنشاء عرض">
            <NewPresentation />
          </ErrorBoundary>
        </Route>
        <Route path="/teacher/presentations/drafts" component={PresentationDrafts} />
        <Route path="/teacher/students/:classStudentId/timeline" component={StudentTimeline} />
        <Route path="/teacher/presentations/activity-runner/:seedId" component={PresentationActivityRunner} />
        <Route path="/teacher/presentations/:id/sessions" component={PresentationSessionsHistory} />
        <Route path="/teacher/presentations/:id/compare" component={PresentationCompare} />
        <Route path="/teacher/presentations/:id/present">
          {/* Wrap in an ErrorBoundary so a runtime crash inside the
              read-only slide renderer (bad slide payload, missing
              theme key, etc.) does not leave the teacher staring at
              a blank page after `window.open(...)` from the editor.
              The dark Suspense fallback prevents a white-flash while
              the lazy chunk loads — present mode is full-screen black
              everywhere else. */}
          <Suspense fallback={<DarkLoadingFallback />}>
            <ErrorBoundary label="عرض الشرائح">
              <PresentationPresent />
            </ErrorBoundary>
          </Suspense>
        </Route>
        <Route path="/teacher/presentations/:id/print">
          <Suspense fallback={<DarkLoadingFallback />}>
            <ErrorBoundary label="طباعة العرض">
              <PresentationPrint />
            </ErrorBoundary>
          </Suspense>
        </Route>
        {/* key={params.id} forces a full remount whenever the presentation
            id in the URL changes (e.g. when the AI builder finishes a
            new deck and navigates from /teacher/presentations/123 →
            /teacher/presentations/456?draftId=N). Without this, wouter
            keeps the same editor instance and we'd have to manually
            tear down slides/refs/autosave timers — which is exactly
            the race that was causing AI-built decks to never appear
            in the editor. A clean unmount/remount eliminates all of
            it: fresh state, fresh react-query, fresh hydration. */}
        <Route path="/teacher/presentations/:id">
          {(params) => (
            <ErrorBoundary label="محرر العروض">
              <PresentationEditor key={params?.id ?? "__none"} />
            </ErrorBoundary>
          )}
        </Route>
        {/* /p/new — convenience alias → teacher creation page */}
        <Route path="/p/new">
          {() => { window.location.replace("/teacher/presentations/new"); return null; }}
        </Route>
        <Route path="/p/control/:sessionId" component={PresentationControl} />
        <Route path="/p/show/:sessionId" component={PresentationShow} />
        <Route path="/p/join" component={PresentationJoin} />
        <Route path="/p/play/:sessionId" component={PresentationPlay} />
        <Route path="/p/results/:sessionId/students/:studentKey" component={StudentInsights} />
        <Route path="/p/results/:sessionId" component={PresentationResults} />
        <Route path="/p/:id">
          <Suspense fallback={<DarkLoadingFallback />}>
            <ErrorBoundary label="عرض الشرائح">
              <PublicPresent />
            </ErrorBoundary>
          </Suspense>
        </Route>
        <Route path="/teacher/video-lesson/new" component={CreateVideoLesson} />
        <Route path="/teacher/create-video-lesson" component={CreateVideoLesson} />
        <Route path="/teacher/video-lesson/:id/live" component={VideoLive} />
        <Route path="/teacher/video-lesson/:id" component={VideoLessonDetail} />
        <Route path="/teacher/parent-messages" component={ParentMessagesPage} />
        <Route path="/teacher" component={TeacherDashboard} />
        {/* Parent Portal — public, no auth */}
        <Route path="/parent/:token" component={ParentPortalPage} />

        {/* Organizer Dashboard */}
        <Route path="/organizer" component={OrganizerDashboard} />

        {/* Student Account Routes */}
        <Route path="/student/login" component={StudentAuth} />
        <Route path="/student/register" component={StudentAuth} />
        <Route path="/student/dashboard" component={StudentDashboard} />
        
        {/* Teacher Smart Board */}
        <Route path="/teacher/smart-board" component={SmartBoardAsk} />
        <Route path="/teacher/smart-board/history" component={SmartBoardHistory} />
        <Route path="/teacher/smart-board/lessons" component={SmartBoard} />
        <Route path="/teacher/smart-board/new" component={SmartBoardNew} />
        <Route path="/teacher/smart-board/edit/:id" component={SmartBoardEdit} />
        <Route path="/teacher/smart-board/present/:id">
          <Suspense fallback={<DarkLoadingFallback />}>
            <ErrorBoundary label="السبورة الذكية">
              <SmartBoardPresent />
            </ErrorBoundary>
          </Suspense>
        </Route>
        <Route path="/solve/adaptive/:id" component={AdaptiveSolve} />
        <Route path="/solve/:id" component={StudentSolve} />
        <Route path="/video/:id" component={StudentVideoLesson} />
        <Route path="/watch/:roomCode" component={StudentVideoLive} />
        <Route path="/board" component={SmartBoardView} />
        <Route path="/board/:code" component={SmartBoardView} />
        
        {/* Game Routes */}
        <Route path="/game/wameeth" component={WameethRedirect} />
        <Route path="/game/wameeth/create" component={WameethCreate} />
        <Route path="/game/wameeth/class" component={WameethClass} />
        <Route path="/game/join/:pin?" component={GameJoin} />
        <Route path="/game/play/:pin" component={GamePlay} />
        {/* Tug of War Routes */}
        <Route path="/game/tug/create" component={TugCreate} />
        <Route path="/game/tug/join/:pin?" component={TugJoin} />
        <Route path="/game/tug/play/:pin" component={TugPlay} />
        <Route path="/game/tug/class" component={TugClass} />
        <Route path="/game/escape/create" component={EscapeCreate} />
        <Route path="/game/escape/class" component={EscapeClass} />
        <Route path="/game/escape/host/:pin" component={EscapeHost} />
        <Route path="/game/escape/play" component={EscapePlay} />
        {/* HotSeat Routes */}
        <Route path="/game/hotseat/create" component={HotSeatCreate} />
        <Route path="/game/hotseat/join/:pin?" component={HotSeatJoin} />
        <Route path="/game/hotseat/play/:pin" component={HotSeatPlay} />
        <Route path="/game/hotseat/host/:pin" component={HotSeatHost} />
        {/* Rocket Race Routes */}
        <Route path="/game/rocket/create" component={RocketCreate} />
        <Route path="/game/rocket/join/:pin?" component={RocketJoin} />
        <Route path="/game/rocket/play/:pin" component={RocketPlay} />
        <Route path="/game/rocket/host/:pin" component={RocketHost} />
        <Route path="/game/wheel/create" component={WheelCreate} />
        <Route path="/game/wheel/play/:id" component={WheelPlay} />
        <Route path="/teacher/worksheets/create" component={WorksheetCreate} />
        <Route path="/teacher/worksheets/:id/print" component={WorksheetPrint} />
        <Route path="/teacher/worksheets/:id/grade" component={WorksheetGrade} />
        <Route path="/teacher/worksheets/:id/report" component={WorksheetReport} />
        <Route path="/teacher/mindmap/create" component={MindMapCreate} />
        <Route path="/teacher/lesson-plans/create" component={LessonPlanCreate} />
        <Route path="/teacher/lesson-plans/:id/print" component={LessonPlanPrint} />
        {/* Flag Quiz Routes */}
        <Route path="/game/flags" component={FlagsSetup} />
        <Route path="/game/flags/play" component={FlagsPlay} />
        <Route path="/game/flags/join/:pin?" component={FlagsJoin} />
        <Route path="/game/flags/multi" component={FlagsMultiPlay} />
        {/* Capital Quiz Routes */}
        <Route path="/game/capitals" component={CapitalsSetup} />
        <Route path="/game/capitals/play" component={CapitalsPlay} />
        <Route path="/game/capitals/join/:pin?" component={CapitalsJoin} />
        <Route path="/game/capitals/multi" component={CapitalsMultiPlay} />
        {/* Color Game Routes */}
        <Route path="/game/color" component={ColorSetup} />
        <Route path="/game/color/play" component={ColorPlay} />
        {/* Multiplication Game Routes */}
        <Route path="/game/multiply" component={MultiplySetup} />
        <Route path="/game/multiply/play" component={MultiplyPlay} />
        {/* Memory Match Routes */}
        <Route path="/game/memory" component={MemorySetup} />
        <Route path="/game/memory/play/:setId?" component={MemoryPlay} />
        <Route path="/game/memory/create" component={MemoryCreate} />
        {/* Letrly (Arabic Wordle) Routes */}
        <Route path="/game/letrly" component={LetrlySetup} />
        <Route path="/game/letrly/play" component={LetrlyPlay} />
        <Route path="/game/letrly/create" component={LetrlyCreate as any} />
        {/* Scrambled Words Routes */}
        <Route path="/game/scramble" component={ScrambleSetup} />
        <Route path="/game/scramble/play" component={ScramblePlay} />
        <Route path="/game/scramble/create" component={ScrambleCreate} />
        <Route path="/game/scramble/monitor" component={ScrambleMonitor} />
        {/* Stroop Effect Routes */}
        <Route path="/game/stroop" component={StroopSetup} />
        <Route path="/game/stroop/play" component={StroopPlay} />
        <Route path="/game/stroop/create" component={StroopCreate} />
        {/* Maraqui Game Routes */}
        <Route path="/game/maraqui" component={MaraquiSetup} />
        <Route path="/game/maraqui/play" component={MaraquiPlay} />
        <Route path="/game/maraqui/create" component={MaraquiCreate} />
        {/* من سيحصد المليون Routes */}
        <Route path="/game/million" component={MillionSetup} />
        <Route path="/game/million/play" component={MillionPlay} />
        <Route path="/game/million/team-setup" component={MillionTeamSetupRedirect} />
        <Route path="/game/million/team-host/:pin" component={MillionTeamHost} />
        <Route path="/game/million/team-play/:pin" component={MillionTeamPlay} />
        <Route path="/game/million/session/:pin/host" component={MillionClassHost} />
        <Route path="/game/million/broadcast/:pin" component={MillionBroadcastHost} />
        <Route path="/game/million/team-control/:pin" component={MillionTeamControlHost} />
        <Route path="/game/million/team-watch/:pin" component={MillionTeamWatch} />
        <Route path="/game/million/join/:pin?" component={MillionJoin} />
        {/* Hack Game Routes — standalone entry plus thin wrappers that reuse shared host/play pages
            (those pages already auto-render the matrix theme when the game's hackMode flag is set
            via the /api/game-info/:pin response and the teacher socket payload). */}
        <Route path="/game/hack" component={HackSetup} />
        <Route path="/game/hack/share/:pin" component={HackShare} />
        <Route path="/game/hack/join/:pin?" component={HackJoinRedirect} />
        <Route path="/game/hack/play/:pin" component={HackPlayRedirect} />
        {/* اكشف السر Routes */}
        <Route path="/game/secret/reveal">
          <Suspense fallback={<LoadingFallback />}>
            <SecretReveal />
          </Suspense>
        </Route>
        <Route path="/game/secret/play">
          <Suspense fallback={<LoadingFallback />}>
            <SecretPlay />
          </Suspense>
        </Route>
        <Route path="/game/secret">
          <Suspense fallback={<LoadingFallback />}>
            <SecretSetup />
          </Suspense>
        </Route>
        <Route path="/game/secret-setup">
          <Suspense fallback={<LoadingFallback />}>
            <SecretSetup />
          </Suspense>
        </Route>
        {/* Hasaad Arena Routes */}
        <Route path="/game/arena/audience">
          <Suspense fallback={<LoadingFallback />}>
            <ArenaAudience />
          </Suspense>
        </Route>
        <Route path="/game/arena">
          <ErrorBoundary
            label="تحدي حصاد"
            onReset={() => {
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("hasad_arena_"))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {
                /* ignore */
              }
            }}
          >
            <ArenaSetup />
          </ErrorBoundary>
        </Route>
        <Route path="/game/arena/play">
          <ErrorBoundary
            label="تحدي حصاد"
            onReset={() => {
              try {
                const wasPublic = sessionStorage.getItem("arena_public_mode") === "1";
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("hasad_arena_"))
                  .forEach((k) => localStorage.removeItem(k));
                sessionStorage.removeItem("arena_public_mode");
                window.location.href = wasPublic ? "/play/arena" : "/game/arena";
              } catch {
                /* ignore */
              }
            }}
          >
            <ArenaPlay />
          </ErrorBoundary>
        </Route>
        {/* Public: اكشف السر student join */}
        <Route path="/play/secret">
          <Suspense fallback={<LoadingFallback />}>
            <PlaySecret />
          </Suspense>
        </Route>
        {/* Public Arena — no login required */}
        <Route path="/play/arena">
          <ErrorBoundary
            label="تحدي حصاد"
            onReset={() => {
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("hasad_arena_"))
                  .forEach((k) => localStorage.removeItem(k));
              } catch { /* ignore */ }
            }}
          >
            <PublicArenaSetup />
          </ErrorBoundary>
        </Route>

        {/* Public Routes */}
        <Route path="/games" component={GamesPage} />
        <Route path="/public/games" component={PublicGamesPage} />
        <Route path="/guest/create" component={GuestCreatePage} />
        <Route path="/solo/:slug" component={SoloPlayPage} />

        <Route path="/install-tutorial" component={InstallTutorial} />
        <Route path="/install" component={InstallPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/about" component={AboutPage} />
        
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function I18nAwareToaster() {
  const { dir } = useI18n();
  return (
    <Toaster
      dir={dir}
      toastOptions={{
        style: {
          fontFamily: "'Tajawal', sans-serif",
        },
      }}
    />
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <I18nProvider>
        <DarkModeProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                  <GlobalAiAssistant />
                  <PageViewTracker />
                  <HeartbeatTracker />
                </WouterRouter>
                <I18nAwareToaster />
              </TooltipProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </DarkModeProvider>
      </I18nProvider>
    </GoogleOAuthProvider>
  );
}

export default App;

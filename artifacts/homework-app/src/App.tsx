import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme-provider";
import { DarkModeProvider } from "@/lib/dark-mode";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const Home = lazy(() => import("@/pages/home"));
const Auth = lazy(() => import("@/pages/auth"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const TeacherDashboard = lazy(() => import("@/pages/teacher/dashboard"));
const CreateAssignment = lazy(() => import("@/pages/teacher/create-assignment"));
const NewActivity = lazy(() => import("@/pages/teacher/new-activity"));
const DictationCreate = lazy(() => import("@/pages/teacher/dictation-create"));
const TeacherAssignmentDetail = lazy(() => import("@/pages/teacher/assignment-detail"));
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
const TeacherProfile = lazy(() => import("@/pages/teacher/profile"));
const TeacherSettings = lazy(() => import("@/pages/teacher/settings"));
const TeacherSessions = lazy(() => import("@/pages/teacher/sessions"));
const AdminPage = lazy(() => import("@/pages/teacher/admin"));
const QuestionBankPage = lazy(() => import("@/pages/teacher/question-bank"));
const WhiteboardMonitor = lazy(() => import("@/pages/teacher/whiteboard-monitor"));
const SharedContentPage = lazy(() => import("@/pages/teacher/shared-content"));
const CategoriesPage = lazy(() => import("@/pages/teacher/categories"));
const CollectionsPage = lazy(() => import("@/pages/teacher/collections"));
const ClassGrades = lazy(() => import("@/pages/teacher/class-grades"));
const PresentationsList = lazy(() => import("@/pages/teacher/presentations/index"));
const PresentationsNew = lazy(() => import("@/pages/teacher/presentations/new"));
const PresentationEdit = lazy(() => import("@/pages/teacher/presentations/edit"));
const PresentationPresent = lazy(() => import("@/pages/teacher/presentations/present"));
const PublicPresentationView = lazy(() => import("@/pages/presentations/public-view"));
const CreateVideoLesson = lazy(() => import("@/pages/teacher/create-video-lesson"));
const VideoLessonDetail = lazy(() => import("@/pages/teacher/video-lesson-detail"));
const StudentVideoLesson = lazy(() => import("@/pages/student/video-lesson"));
const AdaptiveSolve = lazy(() => import("@/pages/student/adaptive-solve"));
const PublicGamesPage = lazy(() => import("@/pages/public-games"));
const GuestCreatePage = lazy(() => import("@/pages/guest-create"));
const TugCreate = lazy(() => import("@/pages/game/tug-create"));
const TugJoin = lazy(() => import("@/pages/game/tug-join"));
const TugPlay = lazy(() => import("@/pages/game/tug-play"));
const HotSeatCreate = lazy(() => import("@/pages/game/hotseat-create"));
const HotSeatHost = lazy(() => import("@/pages/game/hotseat-host"));
const HotSeatJoin = lazy(() => import("@/pages/game/hotseat-join"));
const HotSeatPlay = lazy(() => import("@/pages/game/hotseat-play"));
const RocketCreate = lazy(() => import("@/pages/game/rocket-create"));
const RocketJoin = lazy(() => import("@/pages/game/rocket-join"));
const RocketPlay = lazy(() => import("@/pages/game/rocket-play"));
const RocketHost = lazy(() => import("@/pages/game/rocket-host"));
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
const InstallTutorial = lazy(() => import("@/pages/install-tutorial"));
const InstallPage = lazy(() => import("@/pages/install"));

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
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Auth} />
        <Route path="/register" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        
        {/* Teacher Routes — most specific `/teacher/*` paths first; dashboard `/teacher` last */}
        <Route path="/teacher/new/assignment" component={CreateAssignment} />
        <Route path="/teacher/new/dictation" component={DictationCreate} />
        <Route path="/teacher/new" component={NewActivity} />
        <Route path="/teacher/assignment/:id" component={TeacherAssignmentDetail} />
        <Route path="/teacher/students" component={StudentsPage} />
        <Route path="/teacher/library" component={TeacherLibraryPage} />
        <Route path="/teacher/profile" component={TeacherProfile} />
        <Route path="/teacher/settings" component={TeacherSettings} />
        <Route path="/teacher/sessions" component={TeacherSessions} />
        <Route path="/teacher/admin" component={AdminPage} />
        <Route path="/teacher/question-bank" component={QuestionBankPage} />
        <Route path="/teacher/game/:pin" component={TeacherGame} />
        <Route path="/teacher/whiteboard/:assignmentId/:questionId" component={WhiteboardMonitor} />
        <Route path="/teacher/shared" component={SharedContentPage} />
        <Route path="/teacher/categories" component={CategoriesPage} />
        <Route path="/teacher/collections" component={CollectionsPage} />
        <Route path="/teacher/class-grades/:gradeLevel" component={ClassGrades} />
        <Route path="/teacher/presentations" component={PresentationsList} />
        <Route path="/teacher/presentations/new" component={PresentationsNew} />
        <Route path="/teacher/presentations/:id/present" component={PresentationPresent} />
        <Route path="/teacher/presentations/:id" component={PresentationEdit} />
        <Route path="/p/:id" component={PublicPresentationView} />
        <Route path="/teacher/video-lesson/new" component={CreateVideoLesson} />
        <Route path="/teacher/create-video-lesson" component={CreateVideoLesson} />
        <Route path="/teacher/video-lesson/:id/live" component={VideoLive} />
        <Route path="/teacher/video-lesson/:id" component={VideoLessonDetail} />
        <Route path="/teacher" component={TeacherDashboard} />

        {/* Student Account Routes */}
        <Route path="/student/login" component={StudentAuth} />
        <Route path="/student/register" component={StudentAuth} />
        <Route path="/student/dashboard" component={StudentDashboard} />
        
        {/* Student Routes */}
        <Route path="/solve/adaptive/:id" component={AdaptiveSolve} />
        <Route path="/solve/:id" component={StudentSolve} />
        <Route path="/video/:id" component={StudentVideoLesson} />
        <Route path="/watch/:roomCode" component={StudentVideoLive} />
        
        {/* Game Routes */}
        <Route path="/game/join/:pin?" component={GameJoin} />
        <Route path="/game/play/:pin" component={GamePlay} />
        {/* Tug of War Routes */}
        <Route path="/game/tug/create" component={TugCreate} />
        <Route path="/game/tug/join/:pin?" component={TugJoin} />
        <Route path="/game/tug/play/:pin" component={TugPlay} />
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
        {/* Public Routes */}
        <Route path="/games" component={GamesPage} />
        <Route path="/public/games" component={PublicGamesPage} />
        <Route path="/guest/create" component={GuestCreatePage} />

        <Route path="/install-tutorial" component={InstallTutorial} />
        <Route path="/install" component={InstallPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/faq" component={FaqPage} />
        
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

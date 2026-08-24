import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import {
  ShieldAlert,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  MessageSquare,
  Clock,
  Settings,
  Zap,
  Bot,
  User,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

type AssistantData = {
  configuration: {
    ownerPhoneConfigured: boolean;
    verificationTokenConfigured: boolean;
    appSecretConfigured: boolean;
    outboundEnabled: boolean;
    aiEnabled: boolean;
  };
  threads: Array<{
    id: number;
    channel: string;
    lastMessageAt: string;
    createdAt: string;
    updatedAt: string;
  }>;
  messages: Array<{
    id: number;
    threadId: number;
    externalMessageId: string;
    direction: string;
    messageText: string;
    receivedAt: string;
  }>;
  actions: Array<{
    id: number;
    threadId: number;
    messageId: number;
    actionType: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
  }>;
};

function ConfigPanel({ config }: { config: AssistantData['configuration'] }) {
  const items = [
    { label: "رقم المالك مهيأ", active: config.ownerPhoneConfigured },
    { label: "التحقق مهيأ", active: config.verificationTokenConfigured && config.appSecretConfigured },
    { label: config.outboundEnabled ? "الإرسال الخارجي مفعّل" : "الإرسال الخارجي مغلق", active: config.outboundEnabled },
    { label: config.aiEnabled ? "الذكاء الاصطناعي مفعّل" : "الذكاء الاصطناعي غير مفعّل", active: config.aiEnabled },
  ];

  return (
    <Card className="px-5 py-4 mb-8 bg-card border-border/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-sm">حالة التكوين</h2>
          <p className="text-xs text-muted-foreground mt-0.5">مؤشرات تشغيل المساعد</p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 px-3 py-1.5 rounded-lg">
            {item.active ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
            )}
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PersonalAssistant() {
  const [data, setData] = useState<AssistantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<number | null>(null);
  const [deletingThread, setDeletingThread] = useState<number | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/personal-assistant`, {
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        setError("unauthorized");
        setData(null);
      } else if (!res.ok) {
        setError("error");
        setData(null);
      } else {
        const json = await res.json();
        setData(json);
        setError(null);
      }
    } catch (err) {
      setError("error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const confirmAction = async (id: number) => {
    setProcessingAction(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/personal-assistant/actions/${id}/confirm`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        await fetchData();
        toast.success("تم اعتماد مهمة المراجعة. لم يُرسل أي رد خارجي.");
      } else {
        toast.error("تعذّر اعتماد المهمة. قد تكون حالتها تغيرت.");
      }
    } catch {
      toast.error("تعذّر الاتصال لتحديث المهمة.");
    } finally {
      setProcessingAction(null);
    }
  };

  const cancelAction = async (id: number) => {
    setProcessingAction(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/personal-assistant/actions/${id}/cancel`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        await fetchData();
        toast.success("تم إلغاء مهمة المراجعة.");
      } else {
        toast.error("تعذّر إلغاء المهمة. قد تكون حالتها تغيرت.");
      }
    } catch {
      toast.error("تعذّر الاتصال لتحديث المهمة.");
    } finally {
      setProcessingAction(null);
    }
  };

  const deleteThread = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه المحادثة بالكامل؟ سيتم حذف جميع الرسائل والإجراءات المرتبطة بها.")) return;
    setDeletingThread(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/personal-assistant/threads/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
        credentials: "include",
      });
      if (res.ok) {
        if (selectedThreadId === id) setSelectedThreadId(null);
        await fetchData();
        toast.success("تم حذف المحادثة وسجلها المرتبط.");
      } else {
        toast.error("تعذّر حذف المحادثة.");
      }
    } catch {
      toast.error("تعذّر الاتصال لحذف المحادثة.");
    } finally {
      setDeletingThread(null);
    }
  };

  const selectedThread = useMemo(() => {
    return data?.threads.find(t => t.id === selectedThreadId);
  }, [data, selectedThreadId]);

  const threadMessages = useMemo(() => {
    if (!selectedThreadId || !data) return [];
    return data.messages
      .filter(m => m.threadId === selectedThreadId)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  }, [data, selectedThreadId]);

  const threadActions = useMemo(() => {
    if (!selectedThreadId || !data) return [];
    return data.actions
      .filter(a => a.threadId === selectedThreadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, selectedThreadId]);

  if (loading && !data && !error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error === "unauthorized") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">الوصول مقيد</h1>
          <p className="text-muted-foreground max-w-md text-center">
            هذه المساحة مخصصة للمراجعة الخاصة بمروان (المساعد الشخصي). لا تملك الصلاحيات الكافية لعرض هذه البيانات.
          </p>
        </div>
      </Layout>
    );
  }

  if (error === "error") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">حدث خطأ</h1>
          <p className="text-muted-foreground max-w-md text-center mb-6">
            تعذر تحميل بيانات المساعد الشخصي. يرجى المحاولة مرة أخرى لاحقاً.
          </p>
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              مساعد مروان الشخصي
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">مراجعة الرسائل الواردة ومهامها فقط؛ لا توجد رسائل مرسلة أو ذكاء اصطناعي.</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2 shrink-0 border-border/80 shadow-sm bg-card hover:bg-muted">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            تحديث البيانات
          </Button>
        </div>

        {data && <ConfigPanel config={data.configuration} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Threads List (Right Column in RTL) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-bold text-sm text-muted-foreground">المحادثات ({data?.threads.length || 0})</h3>
            </div>
            
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1 pb-4">
              {data?.threads.map(thread => {
                const pendingCount = data.actions.filter(a => a.threadId === thread.id && a.status === 'pending_review').length;
                const msgsCount = data.messages.filter(m => m.threadId === thread.id).length;
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      "w-full text-start p-4 rounded-xl border transition-all duration-200 block",
                      selectedThreadId === thread.id
                        ? "bg-primary/5 border-primary/30 shadow-sm"
                        : "bg-card border-border hover:border-primary/20 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className={cn("w-4 h-4", selectedThreadId === thread.id ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-bold text-sm" dir="ltr">{thread.channel}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        {msgsCount} رسائل
                      </span>
                      {pendingCount > 0 && (
                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-200/50 dark:border-amber-700/50">
                          {pendingCount} معلق
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              
              {data?.threads.length === 0 && (
                <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-card">
                  <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">لا توجد محادثات مسجلة</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Thread Detail (Left Column in RTL) */}
          <div className="lg:col-span-8">
            {selectedThread ? (
              <Card className="flex flex-col h-[650px] border-border/60 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-sm">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground" dir="ltr">{selectedThread.channel}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        بُدأت: {format(new Date(selectedThread.createdAt), 'yyyy/MM/dd', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive px-3 py-1.5 h-auto text-xs"
                    onClick={() => deleteThread(selectedThread.id)}
                    disabled={deletingThread === selectedThread.id}
                  >
                    {deletingThread === selectedThread.id ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" /> : <Trash2 className="w-3.5 h-3.5 ml-1.5" />}
                    حذف المحادثة
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
                  {threadMessages.map(msg => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div key={msg.id} className={cn("flex w-full", isInbound ? "justify-start" : "justify-end")}>
                        <div className={cn("max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 relative flex flex-col",
                          isInbound 
                            ? "bg-card border border-border/50 text-foreground rounded-tr-sm shadow-sm" 
                            : "bg-primary text-primary-foreground rounded-tl-sm shadow-sm"
                        )}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.messageText}</p>
                          <div className={cn("text-[10px] mt-1.5 flex items-center gap-1 self-end", 
                            isInbound ? "text-muted-foreground" : "text-primary-foreground/70"
                          )}>
                            {format(new Date(msg.receivedAt), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {threadMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60">
                      <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm font-medium">لا توجد رسائل مسجلة</p>
                    </div>
                  )}
                </div>

                {threadActions.length > 0 && (
                  <div className="border-t border-border bg-card p-5 z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-amber-500" />
                      الإجراءات المرتبطة بالمحادثة
                    </h4>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {threadActions.map(action => (
                        <div key={action.id} className="bg-muted/30 border border-border/60 rounded-xl p-4 transition-colors hover:border-primary/20 hover:bg-muted/50">
                           <div className="flex justify-between items-start mb-1">
                             <div className="flex items-center gap-2 mb-1.5">
                               <span className="font-bold text-sm text-foreground">
                                {action.actionType === 'review' ? 'مهمة مراجعة' : action.actionType}
                               </span>
                                {action.status === 'pending_review' ? (
                                 <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-bold">قيد المراجعة</span>
                               ) : action.status === 'confirmed' ? (
                                 <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-md font-bold">تم الاعتماد</span>
                               ) : (
                                 <span className="bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-[10px] px-2 py-0.5 rounded-md font-bold">ملغى</span>
                               )}
                             </div>
                           </div>
                           <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                             <Clock className="w-3 h-3" />
                             {format(new Date(action.createdAt), 'yyyy/MM/dd HH:mm', { locale: ar })}
                             {action.reviewedAt && (
                               <>
                                 <span>•</span>
                                 <span>تمت المراجعة: {format(new Date(action.reviewedAt), 'HH:mm')}</span>
                               </>
                             )}
                           </div>
                           
                            {action.status === 'pending_review' && (
                             <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
                               <Button 
                                 onClick={() => confirmAction(action.id)}
                                 disabled={processingAction === action.id}
                                 className="flex-1 py-2 h-auto text-[13px]"
                               >
                                 {processingAction === action.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                   <>
                                     <CheckCircle className="w-4 h-4 ml-1.5" />
                                      اعتماد
                                   </>
                                 )}
                               </Button>
                               <Button 
                                 variant="outline"
                                 onClick={() => cancelAction(action.id)}
                                 disabled={processingAction === action.id}
                                 className="flex-1 py-2 h-auto text-[13px] border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                               >
                                 {processingAction === action.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                   <>
                                     <XCircle className="w-4 h-4 ml-1.5" />
                                     إلغاء الإجراء
                                   </>
                                 )}
                               </Button>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="h-[650px] flex flex-col items-center justify-center border-dashed bg-card/50">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-muted-foreground opacity-40" />
                </div>
                <p className="text-muted-foreground font-semibold text-lg">اختر محادثة من القائمة</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs text-center">
                   تتيح لك هذه الواجهة مراجعة الرسائل الواردة وإدارة مهام المراجعة بشكل آمن.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

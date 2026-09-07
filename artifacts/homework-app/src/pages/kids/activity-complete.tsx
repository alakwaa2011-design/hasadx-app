import React, { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Star, Trophy, Home, Award } from "lucide-react";
import { useKidsAdventureState } from "@/hooks/use-kids";

export default function KidsActivityComplete() {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState(false);
  const { data: adventureState } = useKidsAdventureState();

  useEffect(() => {
    setShow(true);
  }, []);

  return (
    <div className="fixed inset-0 bg-emerald-400 z-50 flex items-center justify-center p-4 font-sans" dir="rtl">
      
      <div className="bg-white rounded-[3rem] p-8 md:p-12 max-w-md w-full text-center shadow-2xl relative animate-in zoom-in duration-500 delay-150">

        
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-400 rounded-full border-8 border-white flex items-center justify-center shadow-lg">
          <Trophy className="w-16 h-16 text-white" />
        </div>

        <div className="mt-16 space-y-6">
          <h2 className="text-4xl font-extrabold text-slate-800">عمل رائع!</h2>
          
          <div className="flex items-center justify-center gap-2 bg-amber-50 py-3 rounded-2xl">
            <span className="text-2xl font-bold text-amber-500">إجمالي نجومك:</span>
            <Star className="w-8 h-8 fill-amber-500 text-amber-500" />
            <span className="text-2xl font-bold text-amber-500">{adventureState?.stars || 0}</span>
          </div>

          <p className="text-lg text-slate-500 font-medium">أنت تتقدم بسرعة يا بطل</p>

          <div className="pt-6 flex flex-col gap-3">
            <Link href="/kids/adventure">
              <button className="w-full py-4 bg-emerald-500 text-white text-xl font-bold rounded-2xl shadow-[0_6px_0_#059669] active:translate-y-1 active:shadow-none transition-all">
                المحطة التالية
              </button>
            </Link>
            <Link href="/kids">
              <button className="w-full py-4 bg-slate-100 text-slate-500 text-xl font-bold rounded-2xl hover:bg-slate-200 transition-all">
                العودة للرئيسية
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

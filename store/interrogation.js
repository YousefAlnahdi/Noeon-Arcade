import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { askDeepSeek } from '@/lib/deepseek';

const DIFFICULTY = {
    easy:   { questions: 10, contradictions: 2, label: 'محقق مبتدئ',   personality: 'متوتر وعصبي، يتلعثم أحياناً، ويزل بسهولة لو ضغطت عليه' },
    medium: { questions: 8,  contradictions: 2, label: 'محقق متمرس',   personality: 'هادي وواثق، لكن عنده تردد خفيف لما يكذب — يبالغ بالتفاصيل أحياناً' },
    hard:   { questions: 6,  contradictions: 3, label: 'كبير المحققين', personality: 'بارد أعصاب، يجاوب بإجابات قصيرة ومراوغة، يحاول يقلب الأسئلة عليك ويشتتك' },
};

const CASE_GEN_PROMPT = `أنت مصمم ألعاب تصنع قضايا للعبة تحقيق جنائي سايبربنك تدور في عام 2087.

اصنع سيناريو تحقيق كامل باللغة العربية. المشتبه به تم إحضاره للاستجواب بخصوص جريمة سايبرانية.

قواعد التصميم المهمة:
- المشتبه به فعلاً ارتكب الجريمة لكنه يدّعي البراءة
- ازرع بالضبط {CONTRADICTION_COUNT} تناقضات في قصته يقدر محقق ذكي يكتشفها
- التناقضات لازم تكون منطقية (تضارب بالتوقيت، ادعاءات مستحيلة، تفاصيل متناقضة) مو كذب واضح
- شخصية المشتبه به: {PERSONALITY}
- السيناريو لازم يكون واقعي بعالم السايبربنك (زراعات عصبية، خوادم بيانات، أنظمة ذكاء اصطناعي، عملات مشفرة)
- كل تناقض لازم يكون ذكي بحيث اللاعب لما يعرفه بالنهاية يقول "كيف ما انتبهت!"

رجّع JSON فقط بدون أي markdown:
{
  "case_id": "CASE-XXXX",
  "crime_title": "عنوان درامي قصير",
  "crime_description": "وصف الجريمة بـ 2-3 جمل",
  "victim_or_target": "من/ما الذي استُهدف",
  "suspect": {
    "name": "الاسم الكامل",
    "alias": "الاسم المستعار / لقب الهاكر",
    "role": "المنصب الوظيفي في الشركة",
    "age": 30,
    "background": "خلفية المشتبه به بـ 2-3 جمل"
  },
  "evidence_summary": "ملخص الأدلة المتوفرة لدى المحقق قبل الاستجواب",
  "suspect_alibi": "رواية المشتبه به لما حصل (3-4 جمل)",
  "contradictions": [
    {
      "area": "الموضوع اللي يكشف التناقض",
      "what_they_claim": "ايش يقول المشتبه به",
      "why_its_wrong": "ليش ما يطابق الواقع",
      "the_slip": "الجملة أو التفصيلة اللي تكشفه لو سألت السؤال الصح",
      "killer_question": "السؤال القاتل اللي يفضحه"
    }
  ],
  "truth": "ايش اللي فعلاً صار (3-4 جمل)",
  "suspect_personality_notes": "كيف يتصرف المشتبه به أثناء الاستجواب"
}`;

const INTERROGATION_PROMPT = `أنت تلعب دور مشتبه به في لعبة تحقيق سايبربنك. ابق في الشخصية طول الوقت.

هويتك:
الاسم: {SUSPECT_NAME}
المنصب: {SUSPECT_ROLE}
الخلفية: {SUSPECT_BACKGROUND}
الشخصية: {PERSONALITY_NOTES}

روايتك (اللي تدّعيه):
{ALIBI}

الحقيقة (تعرفها لكن تحاول تخفيها):
{TRUTH}

التناقضات في قصتك (لازم تظهر بشكل طبيعي لما يُسأل عن مواضيع مرتبطة):
{CONTRADICTIONS}

قواعد الرد:
1. ابق في الشخصية كمشتبه به — بضمير المتكلم، بشكل محادثة عادية
2. حافظ على روايتك لكن لما يُسأل عن مواضيع مرتبطة بالتناقضات، لازم إجاباتك تحتوي على التفاصيل المتناقضة بشكل طبيعي
3. خل إجاباتك قصيرة 1-3 جمل. لا تطوّل
4. أظهر مشاعر مناسبة لشخصيتك (توتر، دفاعية، غرور، الخ)
5. لا تتطوع بمعلومات مهمة — خل المحقق يشتغل عشانها
6. لو ضُغط عليك بخصوص تناقض، تحوّل دفاعي أو غيّر الموضوع
7. لا تكسر الشخصية أبداً ولا تذكر إنك ذكاء اصطناعي
8. لا تكشف الحقيقة مباشرة أبداً
9. استخدم مصطلحات سايبربنك أحياناً
10. جاوب بالعربية دائماً

رد فقط بحوارك داخل الشخصية. بدون JSON، بدون سرد، بدون أفعال بين نجمتين.`;

const ACCUSATION_EVAL_PROMPT = `أنت تقيّم اتهام محقق في لعبة استجواب.

الحقيقة الفعلية:
{TRUTH}

التناقضات الموجودة:
{CONTRADICTIONS}

اتهام المحقق:
{ACCUSATION}

سجل الاستجواب الكامل:
{LOG}

قيّم دقة اتهام المحقق:
- هل حدد الجريمة/الدافع الصحيح؟
- هل اكتشف أي من التناقضات؟
- هل نظريته قريبة من الحقيقة حتى لو مو دقيقة 100%؟

رجّع JSON فقط:
{
  "accuracy": 0-100,
  "verdict": "مُدان" أو "أدلة غير كافية" أو "اتهام خاطئ",
  "contradictions_caught": عدد التناقضات المكتشفة,
  "feedback": "2-3 جمل عن اللي صاب فيه واللي غلط فيه",
  "truth_reveal": "كشف درامي كامل لللي فعلاً صار (3-4 جمل)"
}`;

export { DIFFICULTY };

export const useInterrogationStore = create((set, get) => ({
    gameState: 'menu',
    difficulty: 'medium',
    caseData: null,
    messages: [],
    questionsLeft: 8,
    maxQuestions: 8,
    notes: '',
    accusation: '',
    accusationResult: null,
    score: 0,
    isLoading: false,
    error: null,

    setDifficulty: (d) => {
        const cfg = DIFFICULTY[d];
        set({ difficulty: d, questionsLeft: cfg.questions, maxQuestions: cfg.questions });
    },

    generateCase: async () => {
        set({ isLoading: true, error: null, gameState: 'generating' });

        const diff = get().difficulty;
        const cfg = DIFFICULTY[diff];

        const prompt = CASE_GEN_PROMPT
            .replace('{CONTRADICTION_COUNT}', cfg.contradictions)
            .replace('{PERSONALITY}', cfg.personality);

        try {
            const reply = await askDeepSeek([], {}, prompt, 1000);
            const clean = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const caseData = JSON.parse(clean);

            if (!caseData.suspect || !caseData.contradictions || !caseData.truth) {
                throw new Error('Invalid case data');
            }

            set({
                caseData,
                isLoading: false,
                gameState: 'briefing',
                messages: [],
                notes: '',
                accusation: '',
                accusationResult: null,
                questionsLeft: cfg.questions,
                maxQuestions: cfg.questions,
            });
        } catch (err) {
            console.error('Case generation error:', err);
            set({ isLoading: false, error: 'فشل توليد القضية. حاول مرة ثانية.', gameState: 'menu' });
        }
    },

    enterRoom: () => {
        const cd = get().caseData;
        set({
            gameState: 'interrogating',
            messages: [{
                role: 'system',
                content: `المشتبه به "${cd.suspect.name}" (${cd.suspect.alias}) دخل غرفة الاستجواب. بدأ التسجيل.`,
                timestamp: Date.now()
            }, {
                role: 'suspect',
                content: `أنا قلت كل شي للدورية. ما أعرف ليش أنا هنا أصلاً. ما لي أي علاقة بـ"${cd.crime_title}". يلا خلنا نخلص بسرعة.`,
                timestamp: Date.now() + 100
            }]
        });
    },

    askQuestion: async (question) => {
        const state = get();
        if (state.questionsLeft <= 0 || state.isLoading || state.gameState !== 'interrogating') return;

        const newMsg = { role: 'detective', content: question, timestamp: Date.now() };
        set({
            messages: [...state.messages, newMsg],
            questionsLeft: state.questionsLeft - 1,
            isLoading: true,
        });

        const cd = state.caseData;
        const contradictionText = cd.contradictions
            .map((c, i) => `${i + 1}. المجال: ${c.area}\n   يدّعي: ${c.what_they_claim}\n   الحقيقة: ${c.why_its_wrong}\n   الزلة: ${c.the_slip}`)
            .join('\n\n');

        const sysPrompt = INTERROGATION_PROMPT
            .replace('{SUSPECT_NAME}', cd.suspect.name)
            .replace('{SUSPECT_ROLE}', cd.suspect.role)
            .replace('{SUSPECT_BACKGROUND}', cd.suspect.background)
            .replace('{PERSONALITY_NOTES}', cd.suspect_personality_notes)
            .replace('{ALIBI}', cd.suspect_alibi)
            .replace('{TRUTH}', cd.truth)
            .replace('{CONTRADICTIONS}', contradictionText);

        const chatHistory = [...state.messages, newMsg]
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'detective' ? 'user' : 'assistant',
                content: m.content
            }));

        try {
            const reply = await askDeepSeek(chatHistory, {}, sysPrompt, 250);
            const suspectMsg = { role: 'suspect', content: reply.trim(), timestamp: Date.now() };
            set((s) => ({
                messages: [...s.messages, suspectMsg],
                isLoading: false,
            }));
        } catch (err) {
            console.error('Interrogation error:', err);
            set((s) => ({
                messages: [...s.messages, {
                    role: 'suspect',
                    content: '*يتحرك بعدم ارتياح* ... أحتاج لحظة.',
                    timestamp: Date.now()
                }],
                isLoading: false,
            }));
        }
    },

    setNotes: (n) => set({ notes: n }),
    setAccusation: (a) => set({ accusation: a }),

    beginAccusation: () => set({ gameState: 'accusing' }),

    submitAccusation: async () => {
        const state = get();
        if (!state.accusation.trim() || state.isLoading) return;

        set({ isLoading: true });

        const cd = state.caseData;
        const contradictionText = cd.contradictions
            .map((c, i) => `${i + 1}. ${c.area}: ${c.what_they_claim} — الحقيقة: ${c.why_its_wrong}`)
            .join('\n');

        const logText = state.messages
            .filter(m => m.role !== 'system')
            .map(m => `[${m.role === 'detective' ? 'المحقق' : 'المشتبه'}]: ${m.content}`)
            .join('\n');

        const prompt = ACCUSATION_EVAL_PROMPT
            .replace('{TRUTH}', cd.truth)
            .replace('{CONTRADICTIONS}', contradictionText)
            .replace('{ACCUSATION}', state.accusation)
            .replace('{LOG}', logText);

        try {
            const reply = await askDeepSeek([], {}, prompt, 400);
            const clean = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
            const result = JSON.parse(clean);

            let finalScore = result.accuracy || 0;
            const efficiencyBonus = Math.max(0, Math.round((state.questionsLeft / state.maxQuestions) * 15));
            finalScore = Math.min(100, finalScore + efficiencyBonus);

            set({
                accusationResult: result,
                score: finalScore,
                isLoading: false,
                gameState: 'result',
            });
        } catch (err) {
            console.error('Accusation eval error:', err);
            set({
                accusationResult: {
                    accuracy: 0,
                    verdict: 'خطأ في النظام',
                    feedback: 'تعذر تقييم الاتهام.',
                    truth_reveal: get().caseData?.truth || '',
                    contradictions_caught: 0,
                },
                score: 0,
                isLoading: false,
                gameState: 'result',
            });
        }
    },

    saveSession: async (userId) => {
        const state = get();
        if (!userId) return;
        const tokensEarned = Math.floor(state.score / 20);
        try {
            await supabase.from('game_sessions').insert({
                user_id: userId,
                game_type: 'interrogation',
                game_mode: state.difficulty,
                result: state.score >= 60 ? 'win' : 'loss',
                score: state.score,
                opponent_score: 0,
                tokens_earned: tokensEarned,
                ai_analysis: `استجواب ${state.caseData?.suspect?.name}. الحكم: ${state.accusationResult?.verdict}. الدقة: ${state.accusationResult?.accuracy}%.`,
                telemetry: {
                    case_id: state.caseData?.case_id,
                    difficulty: state.difficulty,
                    questions_used: state.maxQuestions - state.questionsLeft,
                    contradictions_caught: state.accusationResult?.contradictions_caught || 0,
                }
            });
            if (tokensEarned > 0) {
                const { data: profile } = await supabase
                    .from('profiles').select('total_tokens').eq('id', userId).single();
                if (profile) {
                    await supabase.from('profiles')
                        .update({ total_tokens: profile.total_tokens + tokensEarned })
                        .eq('id', userId);
                }
            }
        } catch (err) {
            console.error('Save error:', err);
        }
    },

    resetToMenu: () => {
        set({
            gameState: 'menu',
            caseData: null,
            messages: [],
            notes: '',
            accusation: '',
            accusationResult: null,
            score: 0,
            isLoading: false,
            error: null,
        });
    }
}));

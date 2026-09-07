import React, { useState } from 'react';
import { ChaosTestResult, ChaosLabSuiteResult } from '../types';
import { FlaskConical, Play, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Clock, Layers, Sparkles } from 'lucide-react';

interface ChaosLabPageProps {
  onSuiteComplete?: () => void;
}

export const ChaosLabPage: React.FC<ChaosLabPageProps> = ({ onSuiteComplete }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [suiteResult, setSuiteResult] = useState<ChaosLabSuiteResult | null>(null);
  const [singleResults, setSingleResults] = useState<Record<string, ChaosTestResult>>({});

  const testDefinitions = [
    {
      id: '01',
      title: 'INTERRUPT DURING SPEECH',
      desc: 'Halts active Rime speech, purges audio buffer immediately, fences previous generation.',
    },
    {
      id: '02',
      title: 'TOOL RESULT RACE',
      desc: 'Simulates slow background tool returning after user interruption; fence blocks output.',
    },
    {
      id: '03',
      title: 'STALE RESULT AFTER STATE CHANGE',
      desc: 'Safety condition update invalidates previous generation; old safety checks rejected.',
    },
    {
      id: '04',
      title: 'RAPID INTERRUPTIONS',
      desc: 'High-frequency burst of 3 interruptions within 50ms; ensures monotonic generation indexing.',
    },
    {
      id: '05',
      title: 'AUDIO QUEUE CONFLICT',
      desc: 'Buffered streaming speech chunks discarded synchronously upon interrupt signal.',
    },
    {
      id: '06',
      title: 'FULL INTERRUPT + RECOVERY',
      desc: 'The complete showcase scenario: speech, interrupt, tool race, stale rejection, and Rime recovery.',
    },
  ];

  const runAllTests = async () => {
    setIsRunning(true);
    setRunningTestId('ALL');
    try {
      const res = await fetch('/api/chaos/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data: ChaosLabSuiteResult = await res.json();
      setSuiteResult(data);
      if (onSuiteComplete) onSuiteComplete();
    } catch (err) {
      console.error('Failed to run chaos tests:', err);
    } finally {
      setIsRunning(false);
      setRunningTestId(null);
    }
  };

  const runSingleTest = async (testId: string) => {
    setIsRunning(true);
    setRunningTestId(testId);
    try {
      const res = await fetch('/api/chaos/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
      });
      const data: ChaosTestResult = await res.json();
      setSingleResults((prev) => ({ ...prev, [testId]: data }));
      if (onSuiteComplete) onSuiteComplete();
    } catch (err) {
      console.error(`Failed to run chaos test ${testId}:`, err);
    } finally {
      setIsRunning(false);
      setRunningTestId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-8 bg-[#060911] space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold font-mono text-white tracking-wider m-0">
              CHAOS LAB
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
            BREAK THE VOICE SYSTEM. PROVE THE RECOVERY.
          </p>
        </div>

        {/* Global Suite Runner */}
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-mono text-xs font-bold tracking-wider transition-all shadow-[0_0_25px_rgba(99,102,241,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isRunning && runningTestId === 'ALL' ? 'animate-spin' : 'fill-current'}`} />
          <span>{isRunning && runningTestId === 'ALL' ? 'EXECUTING CHAOS SUITE...' : 'RUN ALL CHAOS TESTS'}</span>
        </button>
      </div>

      {/* Aggregate Results Scoreboard */}
      {suiteResult && (
        <div className="p-5 rounded-2xl bg-[#0a1020] border border-cyan-500/30 font-mono shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
              <div className="text-[10px] text-slate-400 uppercase">Tests Executed</div>
              <div className="text-2xl font-bold text-white mt-1">{suiteResult.totalTests} TESTS</div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
              <div className="text-[10px] text-slate-400 uppercase">Passed Assertions</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{suiteResult.passedTests} PASSED</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
              <div className="text-[10px] text-slate-400 uppercase">Observed Stale Leaks</div>
              <div className="text-2xl font-bold text-cyan-300 mt-1">
                {suiteResult.totalStaleLeaks} STALE LEAKS
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
              <div className="text-[10px] text-slate-400 uppercase">Total Execution Time</div>
              <div className="text-2xl font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span>{suiteResult.durationMs}ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Definitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testDefinitions.map((test) => {
          const testResult =
            suiteResult?.results.find((r) => r.testId === test.id) || singleResults[test.id];
          const isTestRunning = isRunning && runningTestId === test.id;

          return (
            <div
              key={test.id}
              className={`p-5 rounded-xl border font-mono transition-all ${
                testResult?.passed
                  ? 'bg-[#0a1122]/80 border-emerald-500/30'
                  : testResult?.passed === false
                  ? 'bg-red-950/20 border-red-500/40'
                  : 'bg-[#080d19]/80 border-white/8'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400">TEST {test.id}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs font-bold text-white tracking-wider">{test.title}</span>
                </div>
                {testResult ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                      testResult.passed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {testResult.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {testResult.passed ? 'PASS' : 'FAIL'}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                    STANDBY
                  </span>
                )}
              </div>

              <p className="text-xs font-sans text-slate-400 mb-4 leading-relaxed">{test.desc}</p>

              {/* Execution details & assertions */}
              {testResult && (
                <div className="my-3 p-3 rounded-lg bg-black/40 border border-white/6 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-white/6">
                    <span>Execution: {testResult.durationMs}ms</span>
                    <span className="text-emerald-400 font-bold">{testResult.staleLeaks} Stale Leaks</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {testResult.assertions.map((a, i) => (
                      <div key={i} className="text-slate-300 flex items-start gap-1.5 text-[10px]">
                        <span className="text-cyan-400">✔</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => runSingleTest(test.id)}
                disabled={isRunning}
                className="w-full mt-1 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3 h-3 ${isTestRunning ? 'animate-spin' : ''}`} />
                <span>{isTestRunning ? 'RUNNING...' : `RUN TEST ${test.id}`}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

"use client";

import { useState } from "react";
import { Send, Loader2, Bot, User, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAIMessage, AIMessage } from "@/lib/api/techpack";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: {
    type: string;
    result?: any;
  };
}

interface AIAssistantProps {
  techPackId: string;
  onAIAction?: (action: string, params: any) => void;
}

export function AIAssistant({ techPackId, onAIAction }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "你好！我是 AI 助手。你可以：\n\n1. 要求我重新解析 PDF\n2. 修正特定欄位\n3. 詢問關於 Tech Pack 的問題\n4. 要求我分析特定部分\n\n請告訴我你需要什麼幫助！",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 添加用戶訊息
    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 準備對話歷史（只發送角色和內容）
      const conversationHistory: AIMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 調用真實 API
      const response = await sendAIMessage(
        techPackId,
        userMessage.content,
        conversationHistory
      );

      // 構建 AI 回應訊息
      let aiContent = response.response;

      // 如果有執行操作，附加結果
      if (response.action && response.action_result) {
        const actionType = response.action.type;
        const result = response.action_result;

        if (actionType === 'reparse') {
          aiContent += `\n\n✅ **重新解析完成**\n- AI 信心度: ${result.ai_confidence}%\n- BOM 項目: ${result.bom_items_count}\n- 尺寸規格: ${result.measurements_count}\n- 工序步驟: ${result.construction_steps_count}`;
        } else if (actionType === 'check_bom') {
          aiContent += `\n\n✅ **BOM 檢查完成**\n- 低信心度項目: ${result.low_confidence_count} 項`;
        } else if (actionType === 'find_issues') {
          aiContent += `\n\n✅ **問題檢查完成**\n- 發現問題: ${result.total_issues} 項`;
          if (result.suggestions && result.suggestions.length > 0) {
            aiContent += '\n\n建議修正:\n';
            result.suggestions.slice(0, 3).forEach((s: any, i: number) => {
              aiContent += `${i + 1}. ${s.field}: ${s.suggestion}\n`;
            });
          }
        }
      }

      const aiMessage: Message = {
        role: "assistant",
        content: aiContent,
        timestamp: new Date(),
        action: response.action,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 通知父組件有操作執行
      if (response.action && onAIAction) {
        onAIAction(response.action.type, response.action_result);
      }
    } catch (error: any) {
      // 錯誤處理
      const errorMessage: Message = {
        role: "assistant",
        content: `❌ 抱歉，發生錯誤：${error.message || '無法連接到 AI 服務'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 快捷指令
  const quickCommands = [
    { label: "🔄 重新解析 PDF", command: "重新解析整個 PDF 文件" },
    { label: "✅ 檢查 BOM", command: "檢查 BOM 是否有遺漏或錯誤" },
    { label: "📏 驗證尺寸", command: "驗證所有尺寸規格是否正確" },
    { label: "🔍 找出問題", command: "找出所有需要人工確認的問題" },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">AI 助手</h3>
          <p className="text-xs text-slate-600">輸入指令來操作 AI</p>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <p className="text-xs font-medium text-slate-700 mb-2">快捷指令：</p>
        <div className="flex flex-wrap gap-2">
          {quickCommands.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => setInput(cmd.command)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md hover:bg-blue-50 hover:border-blue-400 transition-colors"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-blue-500 to-purple-600"
                  : "bg-slate-700"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`flex-1 max-w-[80%] ${
                msg.role === "user" ? "text-right" : ""
              }`}
            >
              <div
                className={`inline-block px-4 py-2.5 rounded-2xl ${
                  msg.role === "assistant"
                    ? "bg-slate-100 text-slate-900"
                    : "bg-blue-600 text-white"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1 px-2">
                {msg.timestamp.toLocaleTimeString("zh-TW", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="inline-block px-4 py-2.5 rounded-2xl bg-slate-100">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-slate-600">AI 正在思考...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="輸入你的指令... 例如：「重新解析 BOM」或「檢查尺寸是否正確」"
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="self-end bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          按 Enter 發送，Shift + Enter 換行
        </p>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

// Mock AI 解析结果数据 - 展示 AI 的工作成果
const mockAIData = {
  styleInfo: {
    styleNumber: "LW1FLWS",
    name: "Nulu Cami Tank",
    season: "SP25",
    customer: "Lululemon",
    confidence: 95,
  },
  bom: [
    {
      id: 1,
      category: "Main Fabric",
      material: "Nulu™ Fabric",
      supplier: "Eclat Textile",
      color: "Black",
      consumption: "0.55",
      unit: "yd/pc",
      aiConfidence: 92,
      aiSource: "Page 3, BOM Table Row 1",
      issues: [],
    },
    {
      id: 2,
      category: "Thread",
      material: "Polyester Thread",
      supplier: "Coats",
      color: "Black",
      consumption: "1500",
      unit: "m/cone",
      aiConfidence: 88,
      aiSource: "Page 3, BOM Table Row 2",
      issues: ["Low confidence on supplier name"],
    },
    {
      id: 3,
      category: "Care Label",
      material: "Woven Label",
      supplier: "ABC Labels",
      color: "White/Black",
      consumption: "1",
      unit: "pc",
      aiConfidence: 65,
      aiSource: "Page 5, Trim Section",
      issues: [
        "AI couldn't find exact supplier - guessed from context",
        "Consumption unit unclear",
      ],
    },
  ],
  measurements: [
    {
      id: 1,
      point: "Chest Width",
      code: "A",
      sizes: { XS: "40.0", S: "42.0", M: "44.0", L: "46.0", XL: "48.0" },
      tolerance: "±0.5",
      aiConfidence: 95,
      aiSource: "Page 7, Measurement Chart",
    },
    {
      id: 2,
      point: "Body Length",
      code: "B",
      sizes: { XS: "58.0", S: "59.0", M: "60.0", L: "61.0", XL: "62.0" },
      tolerance: "±0.5",
      aiConfidence: 93,
      aiSource: "Page 7, Measurement Chart",
    },
  ],
  aiIssues: [
    {
      type: "warning",
      severity: "medium",
      field: "BOM Item #3 - Supplier",
      message: "AI confidence only 65% - please verify supplier name manually",
      suggestion: "Check PDF page 5 for correct supplier information",
    },
    {
      type: "missing",
      severity: "high",
      field: "Packaging Material",
      message: "No packaging information found in PDF",
      suggestion: "Add packaging materials manually or upload updated tech pack",
    },
    {
      type: "info",
      severity: "low",
      field: "Construction Details",
      message: "Construction steps parsed successfully (12 steps found)",
      suggestion: null,
    },
  ],
};

export default function TechPackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [activeTab, setActiveTab] = useState<
    "bom" | "measurements" | "construction"
  >("bom");
  const [showIssues, setShowIssues] = useState(true);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/techpacks"
              className="text-slate-600 hover:text-slate-900"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {mockAIData.styleInfo.styleNumber} -{" "}
                {mockAIData.styleInfo.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-slate-600">
                  Season: {mockAIData.styleInfo.season}
                </span>
                <span className="text-sm text-slate-400">•</span>
                <span className="text-sm text-slate-600">
                  Customer: {mockAIData.styleInfo.customer}
                </span>
                <span className="text-sm text-slate-400">•</span>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    AI Confidence: {mockAIData.styleInfo.confidence}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <ThumbsUp className="w-4 h-4" />
              Approve AI Results
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer Placeholder */}
        <div className="w-2/5 border-r border-slate-200 bg-slate-50 p-6">
          <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 h-full flex flex-col items-center justify-center">
            <FileText className="w-16 h-16 text-slate-400 mb-4" />
            <p className="text-slate-600 font-medium mb-2">
              Tech Pack PDF Viewer
            </p>
            <p className="text-slate-500 text-sm text-center max-w-xs">
              In production, this would show the actual PDF with clickable pages
              that sync with AI results
            </p>
            <div className="mt-6 space-y-2 text-sm text-slate-600">
              <div>📄 12 pages detected</div>
              <div>🤖 AI scanned all pages</div>
              <div>✓ BOM found on page 3-4</div>
              <div>✓ Measurements found on page 7</div>
            </div>
          </div>
        </div>

        {/* Right: AI Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* AI Issues Panel */}
          {showIssues && (
            <div className="bg-yellow-50 border-b border-yellow-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-900">
                    AI Found {mockAIData.aiIssues.length} Items Needing
                    Attention
                  </h3>
                </div>
                <button
                  onClick={() => setShowIssues(false)}
                  className="text-yellow-700 hover:text-yellow-900"
                >
                  Dismiss
                </button>
              </div>
              <div className="space-y-2">
                {mockAIData.aiIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      issue.severity === "high"
                        ? "bg-red-100 border border-red-300"
                        : issue.severity === "medium"
                        ? "bg-yellow-100 border border-yellow-300"
                        : "bg-blue-100 border border-blue-300"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {issue.type === "warning" && (
                        <AlertTriangle className="w-4 h-4 text-yellow-700" />
                      )}
                      {issue.type === "missing" && (
                        <AlertTriangle className="w-4 h-4 text-red-700" />
                      )}
                      {issue.type === "info" && (
                        <CheckCircle2 className="w-4 h-4 text-blue-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-900">
                        {issue.field}
                      </div>
                      <div className="text-sm text-slate-700 mt-1">
                        {issue.message}
                      </div>
                      {issue.suggestion && (
                        <div className="text-sm text-slate-600 mt-1 italic">
                          💡 {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white border-b border-slate-200 px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("bom")}
                className={`py-3 px-1 border-b-2 font-medium transition-colors ${
                  activeTab === "bom"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                BOM ({mockAIData.bom.length} items)
              </button>
              <button
                onClick={() => setActiveTab("measurements")}
                className={`py-3 px-1 border-b-2 font-medium transition-colors ${
                  activeTab === "measurements"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Measurements ({mockAIData.measurements.length} points)
              </button>
              <button
                onClick={() => setActiveTab("construction")}
                className={`py-3 px-1 border-b-2 font-medium transition-colors ${
                  activeTab === "construction"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Construction (12 steps)
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "bom" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Bill of Materials - AI Extracted
                  </h2>
                  <div className="text-sm text-slate-600">
                    🤖 Automatically parsed from PDF
                  </div>
                </div>

                {mockAIData.bom.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-lg p-4 ${
                      item.aiConfidence >= 90
                        ? "border-green-200"
                        : item.aiConfidence >= 70
                        ? "border-yellow-200"
                        : "border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-slate-900">
                            {item.id}. {item.material}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {item.category}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-slate-600">Supplier:</span>{" "}
                            <span className="text-slate-900 font-medium">
                              {item.supplier}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">Color:</span>{" "}
                            <span className="text-slate-900 font-medium">
                              {item.color}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">Consumption:</span>{" "}
                            <span className="text-slate-900 font-medium">
                              {item.consumption} {item.unit}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">
                              AI Found at:
                            </span>{" "}
                            <span className="text-blue-700 text-xs">
                              {item.aiSource}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          <div className="text-right">
                            <div
                              className={`text-sm font-medium ${
                                item.aiConfidence >= 90
                                  ? "text-green-700"
                                  : item.aiConfidence >= 70
                                  ? "text-yellow-700"
                                  : "text-red-700"
                              }`}
                            >
                              {item.aiConfidence}%
                            </div>
                            <div className="text-xs text-slate-500">
                              AI Confidence
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="p-1 hover:bg-green-100 rounded">
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                          </button>
                          <button className="p-1 hover:bg-red-100 rounded">
                            <ThumbsDown className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.issues.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="text-sm text-red-700">
                          {item.issues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "measurements" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Measurement Specifications - AI Extracted
                  </h2>
                  <div className="text-sm text-slate-600">
                    🤖 Automatically parsed from size chart
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                          Point
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                          Code
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          XS
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          S
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          M
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          L
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          XL
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          Tolerance
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-700">
                          AI Conf.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {mockAIData.measurements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {m.point}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {m.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-900">
                            {m.sizes.XS}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-900">
                            {m.sizes.S}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-900">
                            {m.sizes.M}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-900">
                            {m.sizes.L}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-900">
                            {m.sizes.XL}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-700">
                            {m.tolerance}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span
                              className={`font-medium ${
                                m.aiConfidence >= 90
                                  ? "text-green-700"
                                  : "text-yellow-700"
                              }`}
                            >
                              {m.aiConfidence}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-blue-900">
                        AI Source Information
                      </div>
                      <div className="text-sm text-blue-700 mt-1">
                        Measurements extracted from: Page 7, Measurement Chart
                      </div>
                      <div className="text-sm text-blue-700 mt-1">
                        Overall confidence: 94% (High accuracy)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "construction" && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Construction Steps (12 steps parsed)
                  </h3>
                  <p className="text-slate-600">
                    Construction details would appear here, parsed from PDF
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

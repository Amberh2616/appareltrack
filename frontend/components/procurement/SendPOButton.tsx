"use client";

import { useState } from "react";
import { Send, Mail, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendPO } from "@/lib/api/purchase-orders";

interface SendPOButtonProps {
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierEmail?: string;
  status: string;
  allLinesConfirmed: boolean;
  sentAt?: string | null;
  sentToEmail?: string | null;
  sentCount?: number;
  onSuccess?: () => void;
}

export function SendPOButton({
  poId,
  poNumber,
  supplierName,
  supplierEmail,
  status,
  allLinesConfirmed,
  sentAt,
  sentToEmail,
  sentCount = 0,
  onSuccess,
}: SendPOButtonProps) {
  const [open, setOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const canSend = allLinesConfirmed && ["draft", "ready", "sent"].includes(status);
  const isResend = status === "sent" || sentCount > 0;
  const targetEmail = customEmail || supplierEmail;

  const handleSend = async () => {
    if (!targetEmail) {
      setResult({
        success: false,
        message: "Please provide an email address",
      });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await sendPO(poId, customEmail || undefined);

      if (response.status === "sent") {
        setResult({
          success: true,
          message: `PO sent successfully to ${response.sent_to}`,
        });
        // Close dialog after 2 seconds on success
        setTimeout(() => {
          setOpen(false);
          setResult(null);
          setCustomEmail("");
          onSuccess?.();
        }, 2000);
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to send PO",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send PO",
      });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-TW");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={!canSend}
          className={isResend ? "bg-blue-500 hover:bg-blue-600" : "bg-blue-600 hover:bg-blue-700"}
          title={
            !allLinesConfirmed
              ? "Please confirm all lines first"
              : !["draft", "ready", "sent"].includes(status)
              ? "Cannot send PO in current status"
              : isResend
              ? "Resend PO to supplier"
              : "Send PO to supplier"
          }
        >
          {isResend ? (
            <RefreshCw className="h-4 w-4 mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {isResend ? "Resend" : "Send to Supplier"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isResend ? "Resend PO to Supplier" : "Send PO to Supplier"}
          </DialogTitle>
          <DialogDescription>
            {isResend
              ? `This PO has been sent ${sentCount} time(s). Send again?`
              : "Send this purchase order via email with PDF attachment."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PO Info */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PO Number:</span>
              <span className="font-medium">{poNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-medium">{supplierName}</span>
            </div>
          </div>

          {/* Previous Send Info */}
          {sentAt && sentToEmail && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 font-medium mb-2">
                Previous Send Record
              </div>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-slate-500">Sent to:</span>{" "}
                  <span className="font-mono">{sentToEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500">Sent at:</span>{" "}
                  {formatDate(sentAt)}
                </div>
                <div>
                  <span className="text-slate-500">Total sends:</span> {sentCount}
                </div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder={supplierEmail || "Enter email address"}
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
            />
            {supplierEmail && !customEmail && (
              <p className="text-sm text-slate-500">
                Default: {supplierEmail}
              </p>
            )}
            {!supplierEmail && !customEmail && (
              <p className="text-sm text-orange-600">
                Supplier has no email set. Please enter an email address.
              </p>
            )}
          </div>

          {/* Result Alert */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !targetEmail}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {isResend ? "Resend Email" : "Send Email"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

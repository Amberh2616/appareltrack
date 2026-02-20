'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Factory, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Card className="w-full max-w-md shadow-xl mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Check Your Email</h2>
              <p className="text-slate-600">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent password reset instructions.
              </p>
              <p className="text-sm text-slate-500">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  try again
                </button>
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <Card className="w-full max-w-md shadow-xl mx-4">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
            <Factory className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
            <CardDescription className="text-base mt-1">
              Enter your email to receive reset instructions
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

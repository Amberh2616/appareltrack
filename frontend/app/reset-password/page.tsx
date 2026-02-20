'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { confirmPasswordReset } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Factory, CheckCircle, XCircle } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    if (!uid || !token) {
      setInvalidLink(true);
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await confirmPasswordReset({
        uid: uid!,
        token: token!,
        password,
        password_confirm: passwordConfirm,
      });
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (invalidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Card className="w-full max-w-md shadow-xl mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Invalid Reset Link</h2>
              <p className="text-slate-600">
                This password reset link is invalid or has expired.
              </p>
              <div className="pt-4">
                <Link href="/forgot-password">
                  <Button className="w-full">Request New Reset Link</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Card className="w-full max-w-md shadow-xl mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Password Reset!</h2>
              <p className="text-slate-600">
                Your password has been successfully reset. Redirecting to login...
              </p>
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
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription className="text-base mt-1">
              Enter your new password
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
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={8}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Confirm New Password</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="Confirm your password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="text-blue-600 hover:text-blue-800 hover:underline">
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { AssistantDialog } from './AssistantDialog';

export function AssistantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-amber-500 hover:bg-amber-600 z-50"
        size="icon"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </Button>

      {/* Dialog */}
      <AssistantDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

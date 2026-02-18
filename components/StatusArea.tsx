"use client";

interface Props {
  message: string;
}

export default function StatusArea({ message }: Props) {
  return (
    <div className="status-area w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2
                    text-center text-sm min-h-[44px] flex items-center justify-center">
      {message}
    </div>
  );
}

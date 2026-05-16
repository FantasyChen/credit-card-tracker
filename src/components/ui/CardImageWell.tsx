import Image from "next/image";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface CardImageWellProps {
  imageUrl?: string | null;
  alt: string;
  issuer?: string | null;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
  unoptimized?: boolean;
}

export default function CardImageWell({
  imageUrl,
  alt,
  issuer,
  className,
  imageClassName,
  priority = false,
  sizes = "240px",
  unoptimized = false,
}: CardImageWellProps) {
  return (
    <div
      className={cn(
        "relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-[radial-gradient(circle_at_top_left,_#ffffff,_#f3f4f6_55%,_#e5e7eb)] p-4 dark:border-gray-700 dark:bg-[radial-gradient(circle_at_top_left,_#1f2937,_#111827_58%,_#030712)]",
        className
      )}
    >
      {imageUrl ? (
        <div className="relative h-full w-full max-w-[230px]">
          <Image
            src={imageUrl}
            alt={alt}
            fill
            className={cn("object-contain drop-shadow-md", imageClassName)}
            sizes={sizes}
            priority={priority}
            unoptimized={unoptimized}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-16 items-center justify-center rounded-md border border-gray-300 bg-white/80 shadow-sm dark:border-gray-600 dark:bg-gray-800/80">
            <CreditCardIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
          </div>
          {issuer && (
            <p className="max-w-[12rem] truncate text-xs font-medium text-gray-500 dark:text-gray-400">
              {issuer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

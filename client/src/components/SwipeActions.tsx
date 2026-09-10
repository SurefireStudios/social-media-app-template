import { Button } from "@/components/ui/button";
import { X, Zap } from "lucide-react";

interface SwipeActionsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const SwipeActions = ({ onSwipeLeft, onSwipeRight }: SwipeActionsProps) => {
  return (
    <div className="flex justify-around items-center py-4 px-6 bg-dark-light border-t border-dark-lighter">
      <Button
        onClick={onSwipeLeft}
        className="w-16 h-16 rounded-full flex items-center justify-center text-red-500 bg-dark-lighter border-2 border-dark-lighter hover:border-red-500 hover:bg-dark-lighter transition-all duration-200"
        variant="ghost"
        size="icon"
      >
        <X className="h-8 w-8" />
      </Button>
      
      <Button
        onClick={onSwipeRight}
        className="w-20 h-20 rounded-full flex items-center justify-center text-primary bg-dark-lighter border-2 border-dark-lighter hover:border-primary hover:bg-dark-lighter transition-all duration-200"
        variant="ghost"
        size="icon"
      >
        <Zap className="h-10 w-10" />
      </Button>
    </div>
  );
};

export default SwipeActions;

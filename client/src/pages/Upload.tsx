import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiUrl } from "@/lib/api";
import { getCurrentTimestamp } from "@/lib/date-utils";

const numericPattern = /^\d{1,4}(\.\d{1,2})?$/;
const numericError = "Enter a number with up to 4 digits (decimals allowed)";

// Define common mining algorithms
const MINING_ALGORITHMS = [
  "SHA-256",     // Bitcoin
  "Ethash",      // Ethereum (pre-merge)
  "Scrypt",      // Litecoin
  "X11",         // Dash
  "Equihash",    // Zcash
  "RandomX",     // Monero
  "KawPow",      // Ravencoin
  "Autolykos2",  // Ergo
  "Blake2b",     // Siacoin
  "CuckooCycle", // Grin
  "Other"        // For any other algorithm
];

const uploadSchema = z.object({
  minerModel: z.string().min(1, "Miner model is required"),
  algorithm: z.string().default("SHA-256"),
  hashrate: z.string()
    .optional()
    .refine(val => !val || numericPattern.test(val), { message: numericError }),
  power: z.string()
    .optional()
    .refine(val => !val || numericPattern.test(val), { message: numericError }),
  temperature: z.string()
    .optional()
    .refine(val => !val || numericPattern.test(val), { message: numericError }),
  efficiency: z.string()
    .optional()
    .refine(val => !val || numericPattern.test(val), { message: numericError }),
  modifications: z.string().optional(),
  image: z.instanceof(File).refine(file => file.size > 0, "Image is required"),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

const Upload = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      minerModel: "",
      algorithm: "SHA-256", // Default to SHA-256
      hashrate: "",
      power: "",
      temperature: "",
      efficiency: "",
      modifications: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormValues) => {
      if (!user) throw new Error("You must be logged in to upload");

      // Validate file type
      const fileType = data.image.type;
      if (fileType !== "image/jpeg" && fileType !== "image/png" && fileType !== "image/jpg") {
        throw new Error("Only JPG and PNG files are allowed");
      }

      const formData = new FormData();
      formData.append("userId", user.id.toString());
      formData.append("minerModel", data.minerModel);
      formData.append("algorithm", data.algorithm);
      if (data.hashrate) formData.append("hashrate", data.hashrate);
      if (data.power) formData.append("power", data.power);
      if (data.temperature) formData.append("temperature", data.temperature);
      if (data.efficiency) formData.append("efficiency", data.efficiency);
      if (data.modifications) formData.append("modifications", data.modifications);
      formData.append("image", data.image);
      // Add timestamp as Unix epoch in milliseconds (UTC timestamp)
      formData.append("timestamp", getCurrentTimestamp().toString());

      try {
        const response = await fetch(getApiUrl("/api/posts"), {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Upload error:", errorData);
          throw new Error(errorData.message || "Failed to upload");
        }

        return response.json();
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate the feed query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      
      toast({
        title: "Success!",
        description: "Your mining rig has been uploaded.",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    form.setValue("image", file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Clean up the URL when component unmounts
    return () => URL.revokeObjectURL(url);
  };

  const onSubmit = (data: UploadFormValues) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload your mining rig",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }
    
    uploadMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-dark-light border-dark-lighter">
          <h2 className="text-xl font-semibold text-light mb-4 text-center">Sign in Required</h2>
          <p className="text-gray-400 mb-6 text-center">
            Please sign in to upload your mining rig.
          </p>
          <div className="flex justify-center">
            <Button onClick={() => setLocation("/auth")} className="bg-primary hover:bg-primary-dark">
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark">
      <div className="p-4">
        <h2 className="text-xl font-semibold text-light mb-4">Upload Your Rig</h2>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Image Upload */}
            <div 
              className={`bg-dark-light rounded-lg p-6 border-2 border-dashed ${
                previewUrl ? 'border-primary' : 'border-dark-lighter'
              } flex flex-col items-center justify-center mb-6 cursor-pointer relative overflow-hidden`}
              onClick={() => document.getElementById('image-upload')?.click()}
            >
              <input 
                id="image-upload" 
                type="file" 
                accept="image/jpeg,image/png" 
                className="hidden"
                onChange={handleImageChange}
              />
              
              {previewUrl ? (
                <div className="w-full h-48 relative">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <>
                  <UploadIcon className="h-10 w-10 text-gray-500 mb-3" />
                  <p className="text-center text-gray-400 mb-1">Drag and drop your image here</p>
                  <p className="text-center text-gray-500 text-sm">PNG, JPG up to 25MB</p>
                </>
              )}
              
              <Button 
                type="button" 
                variant="outline" 
                className="mt-4 bg-dark-lighter text-light border-dark-lighter"
              >
                {previewUrl ? 'Change Image' : 'Select from device'}
              </Button>
              
              {form.formState.errors.image && (
                <p className="text-red-500 text-sm mt-2">{form.formState.errors.image.message}</p>
              )}
            </div>
            
            {/* Rig Details Form */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minerModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Miner Model</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Bitaxe Gamma" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="algorithm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Mining Algorithm</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-dark-light border-dark-lighter text-light">
                          <SelectValue placeholder="Select algorithm" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-dark-light border-dark-lighter text-light">
                        {MINING_ALGORITHMS.map((algo) => (
                          <SelectItem key={algo} value={algo}>
                            {algo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hashrate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Hashrate (TH/s)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="458" 
                        type="number"
                        max="9999"
                        step="0.1"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="power"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Power Consumption (W)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="1400" 
                        type="number"
                        max="9999"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Temperature (°C)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="58" 
                        type="number"
                        max="9999"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="efficiency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Efficiency (J/TH)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="29.5" 
                        type="number"
                        max="9999"
                        step="0.1"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="modifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-400">Modifications</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe any custom modifications to your rig..." 
                      rows={3}
                      
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full py-3 bg-primary text-white font-medium hover:bg-primary-dark"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : 'Upload Mining Rig'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Upload;

// components/CreateListing.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { debounce } from 'lodash';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Save, MapPin, Navigation, DollarSign } from 'lucide-react';

// Types & Schema
const addressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  area: z.string().min(1, "Area is required"),
  landmark: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{5,6}$/, "Invalid pincode format"),
  country: z.string().min(1, "Country is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const listingFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  type: z.enum(['item', 'service']),
  category_id: z.string().min(1, "Category is required"),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  price: z.number().min(0, "Price must be positive").optional(),
  price_type: z.enum(['fixed', 'hourly', 'per_day', 'negotiable']),
  delivery_options: z.array(z.enum(['pickup', 'delivery', 'both'])).min(1, "Select at least one delivery option"),
  images: z.array(z.string()).min(1, "At least one image is required").max(10, "Maximum 10 images allowed"),
  address: addressSchema.optional(),
}).refine((data) => {
  if (data.type === 'item' && (!data.price || data.price <= 0)) {
    return false;
  }
  return true;
}, {
  message: "Price is required for items",
  path: ["price"],
});

type ListingFormValues = z.infer<typeof listingFormSchema>;

// Image Compression Utility
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > 1920) {
        height = (height * 1920) / width;
        width = 1920;
      }

      if (height > 1080) {
        width = (width * 1080) / height;
        height = 1080;
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Auto-Save Hook
const useAutoSave = <T,>(
  form: UseFormReturn<T>,
  storageKey: string,
  delay: number = 1000
) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        form.reset(draftData);
      } catch (error) {
        console.error('Error loading saved draft:', error);
      }
    }
  }, [storageKey, form]);

  useEffect(() => {
    const debouncedSave = debounce((data: T) => {
      localStorage.setItem(storageKey, JSON.stringify(data));
    }, delay);

    const subscription = form.watch((data) => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      debouncedSave(data);
    });

    return () => {
      debouncedSave.cancel();
      subscription.unsubscribe();
    };
  }, [form, storageKey, delay]);
};

// BasicInfoForm Component
const BasicInfoForm = ({ form, categories }: { form: UseFormReturn<ListingFormValues>, categories: any[] }) => {
  const { register, formState: { errors }, watch, setValue } = form;
  const listingType = watch('type');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="What are you sharing?"
            {...register('title')}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your item or service in detail..."
            {...register('description')}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select onValueChange={(value: 'item' | 'service') => form.setValue('type', value)} defaultValue="item">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item">Item</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Select onValueChange={(value) => form.setValue('category_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive">{errors.category_id.message}</p>
            )}
          </div>
        </div>

        {listingType === 'item' && (
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select onValueChange={(value: any) => form.setValue('condition', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="like_new">Like New</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ImageUploader Component
const ImageUploader = ({ form, userId }: { form: UseFormReturn<ListingFormValues>, userId: string }) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const images = form.watch('images') || [];

  const handleImageUpload = useCallback(async (files: FileList) => {
    if (!userId) return;
    
    setUploading(true);
    const newImageUrls: string[] = [];

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 5MB)`);
        }

        const compressedFile = await compressImage(file);

        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('listing-images')
          .upload(fileName, compressedFile);

        if (error) throw error;

        const { data } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);

        return data.publicUrl;
      });

      const results = await Promise.allSettled(uploadPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          newImageUrls.push(result.value);
        } else {
          toast({
            title: "Upload failed",
            description: result.reason.message,
            variant: "destructive"
          });
        }
      });

      if (newImageUrls.length > 0) {
        form.setValue('images', [...images, ...newImageUrls]);
      }
    } catch (error) {
      toast({
        title: "Upload error",
        description: "Failed to upload images",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [userId, images, form, toast]);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    form.setValue('images', newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    form.setValue('images', newImages);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files);
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <Label htmlFor="images" className="cursor-pointer">
            <span className="text-primary font-medium">Click to upload images</span>
            <span className="text-muted-foreground"> or drag and drop</span>
          </Label>
          <Input
            id="images"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-2">
            PNG, JPG up to 5MB each. First image will be the cover.
          </p>
          {uploading && (
            <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
          )}
        </div>

        {images.length > 0 && (
          <div className="space-y-2">
            <Label>Uploaded Images ({images.length}/10)</Label>
            <div className="grid grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  {index === 0 && (
                    <div className="absolute top-1 left-1">
                      <Badge variant="secondary" className="text-xs">Cover</Badge>
                    </div>
                  )}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveImage(index, index - 1)}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                    )}
                    {index < images.length - 1 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveImage(index, index + 1)}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {form.formState.errors.images && (
          <p className="text-sm text-destructive">{form.formState.errors.images.message}</p>
        )}
      </CardContent>
    </Card>
  );
};

// PricingDeliveryForm Component
const PricingDeliveryForm = ({ form }: { form: UseFormReturn<ListingFormValues> }) => {
  const { register, formState: { errors }, watch, setValue } = form;
  const listingType = watch('type');
  const deliveryOptions = watch('delivery_options') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing & Delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('price', { valueAsNumber: true })}
            />
            {errors.price && (
              <p className="text-sm text-destructive">{errors.price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_type">Price Type</Label>
            <Select onValueChange={(value: any) => setValue('price_type', value)} defaultValue="fixed">
              <SelectTrigger>
                <SelectValue placeholder="Select price type" />
              </SelectTrigger>
              <SelectContent>
                {listingType === 'service' && (
                  <>
                    <SelectItem value="hourly">per Hour</SelectItem>
                    <SelectItem value="per_day">per Day</SelectItem>
                  </>
                )}
                <SelectItem value="fixed">Fixed Price</SelectItem>
                <SelectItem value="negotiable">Negotiable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Delivery Options</Label>
          <div className="flex gap-4">
            {['pickup', 'delivery', 'both'].map((option) => (
              <label key={option} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={deliveryOptions.includes(option as any)}
                  onChange={(e) => {
                    const currentOptions = deliveryOptions;
                    if (e.target.checked) {
                      setValue('delivery_options', [...currentOptions, option as any]);
                    } else {
                      setValue('delivery_options', currentOptions.filter(opt => opt !== option));
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm capitalize">
                  {option === 'both' ? 'Both' : option}
                </span>
              </label>
            ))}
          </div>
          {errors.delivery_options && (
            <p className="text-sm text-destructive">{errors.delivery_options.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// LocationForm Component
const LocationForm = ({ form }: { form: UseFormReturn<ListingFormValues> }) => {
  const { register, formState: { errors }, setValue, watch } = form;
  const { toast } = useToast();
  const address = watch('address');

  const handleGeocode = async () => {
    const currentAddress = form.getValues('address');
    
    if (!currentAddress?.street || !currentAddress?.city || !currentAddress?.pincode) {
      toast({
        title: "Missing information",
        description: "Please fill in street, city, and pincode first",
        variant: "destructive"
      });
      return;
    }

    try {
      const { street, area, city, state, pincode, country } = currentAddress;
      const query = `${street}, ${area}, ${city}, ${state}, ${pincode}, ${country}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      
      const data = await response.json();
      
      if (data && data[0]) {
        setValue('address.latitude', parseFloat(data[0].lat));
        setValue('address.longitude', parseFloat(data[0].lon));
        
        toast({
          title: "Location found",
          description: "Coordinates have been set based on your address",
        });
      } else {
        toast({
          title: "Location not found",
          description: "Please check your address details",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Geocoding failed",
        description: "Could not fetch coordinates for this address",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              placeholder="123 Main Street"
              {...register('address.street')}
            />
            {errors.address?.street && (
              <p className="text-sm text-destructive">{errors.address.street.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Area / Locality</Label>
            <Input
              id="area"
              placeholder="Downtown"
              {...register('address.area')}
            />
            {errors.address?.area && (
              <p className="text-sm text-destructive">{errors.address.area.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="landmark">Landmark (Optional)</Label>
          <Input
            id="landmark"
            placeholder="Near Central Park"
            {...register('address.landmark')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="New York"
              {...register('address.city')}
            />
            {errors.address?.city && (
              <p className="text-sm text-destructive">{errors.address.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              placeholder="NY"
              {...register('address.state')}
            />
            {errors.address?.state && (
              <p className="text-sm text-destructive">{errors.address.state.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              placeholder="10001"
              {...register('address.pincode')}
            />
            {errors.address?.pincode && (
              <p className="text-sm text-destructive">{errors.address.pincode.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            placeholder="United States"
            defaultValue="United States"
            {...register('address.country')}
          />
          {errors.address?.country && (
            <p className="text-sm text-destructive">{errors.address.country.message}</p>
          )}
        </div>

        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <Navigation className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Location Coordinates</p>
            <p className="text-sm text-muted-foreground">
              {address?.latitude && address?.longitude 
                ? `Lat: ${address.latitude.toFixed(4)}, Lng: ${address.longitude.toFixed(4)}`
                : 'No coordinates set'
              }
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleGeocode}>
            Get from Address
          </Button>
        </div>

        {address?.latitude && address?.longitude && (
          <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">
              Map preview would show here with Leaflet + OpenStreetMap
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ListingPreview Component
const ListingPreview = ({ formData }: { formData: ListingFormValues }) => {
  const {
    title,
    description,
    type,
    condition,
    price,
    price_type,
    delivery_options,
    images,
    address
  } = formData;

  const getPriceText = () => {
    if (!price) return 'Free';
    
    const priceTypeMap = {
      hourly: '/hour',
      per_day: '/day',
      fixed: '',
      negotiable: ' (Negotiable)'
    };

    return `$${price}${priceTypeMap[price_type] || ''}`;
  };

  const getConditionText = (cond: string) => {
    const conditionMap = {
      new: 'New',
      like_new: 'Like New',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor'
    };
    return conditionMap[cond as keyof typeof conditionMap] || cond;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {images && images.length > 0 && (
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <img
              src={images[0]}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-xl font-semibold">{title || 'Your listing title'}</h3>
            <Badge variant={type === 'item' ? 'default' : 'secondary'}>
              {type === 'item' ? 'Item' : 'Service'}
            </Badge>
          </div>

          <p className="text-muted-foreground">
            {description || 'Your description will appear here'}
          </p>

          {condition && type === 'item' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Condition:</span>
              <Badge variant="outline">{getConditionText(condition)}</Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <DollarSign className="h-5 w-5 text-green-600" />
          <div>
            <span className="text-2xl font-bold">{getPriceText()}</span>
            {price_type === 'negotiable' && (
              <span className="text-sm text-muted-foreground ml-2">Starting price</span>
            )}
          </div>
        </div>

        {delivery_options && delivery_options.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Delivery Options</h4>
            <div className="flex gap-2">
              {delivery_options.map(option => (
                <Badge key={option} variant="secondary" className="capitalize">
                  {option}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {address && (
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{address.area}, {address.city}</p>
              <p className="text-sm text-muted-foreground">
                {address.street}, {address.state} {address.pincode}
              </p>
              {address.landmark && (
                <p className="text-sm text-muted-foreground">
                  Near {address.landmark}
                </p>
              )}
            </div>
          </div>
        )}

        {images && images.length > 1 && (
          <div className="space-y-2">
            <h4 className="font-medium">Additional Images ({images.length - 1})</h4>
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1).map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`${title} ${index + 2}`}
                  className="w-full h-16 object-cover rounded"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main CreateListingWizard Component
const CreateListingWizard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionLoading, setSubmissionLoading] = useState(false);

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      type: 'item',
      price_type: 'fixed',
      delivery_options: ['pickup'],
      images: [],
    },
    mode: 'onChange',
  });

  useAutoSave(form, `listing-draft-${user?.id}`, 2000);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*');
      return data || [];
    }
  });

  const steps = [
    { id: 'basic', title: 'Basic Info', component: BasicInfoForm },
    { id: 'images', title: 'Images', component: ImageUploader },
    { id: 'pricing', title: 'Pricing & Delivery', component: PricingDeliveryForm },
    { id: 'location', title: 'Location', component: LocationForm },
    { id: 'preview', title: 'Preview & Submit', component: ListingPreview },
  ];

  const CurrentStepComponent = steps[currentStep].component;

  const nextStep = async () => {
    const fields = getStepFields(currentStep);
    const isValid = await form.trigger(fields as any);
    
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      toast({
        title: "Please fix errors",
        description: "There are errors in the current step that need to be fixed",
        variant: "destructive"
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const getStepFields = (step: number): (keyof ListingFormValues)[] => {
    const stepFields: Record<number, (keyof ListingFormValues)[]> = {
      0: ['title', 'description', 'type', 'category_id', 'condition'],
      1: ['images'],
      2: ['price', 'price_type', 'delivery_options'],
      3: ['address'],
      4: []
    };
    return stepFields[step] || [];
  };

  const submitListing = async (formData: ListingFormValues): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a listing",
        variant: "destructive"
      });
      return false;
    }

    setSubmissionLoading(true);

    try {
      const listingData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        category_id: formData.category_id,
        condition: formData.type === 'service' ? null : formData.condition,
        price: formData.price,
        price_type: formData.price_type,
        delivery_options: Array.isArray(formData.delivery_options) 
          ? formData.delivery_options 
          : [formData.delivery_options],
        seller_id: user.id,
        address: formData.address,
        status: 'active',
        images: formData.images,
      };

      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert([listingData])
        .select()
        .single();

      if (listingError) throw listingError;

      toast({
        title: "Listing created successfully!",
        description: "Your item is now available for sharing",
      });

      return true;

    } catch (error: any) {
      console.error('Submission error:', error);
      
      if (formData.images && formData.images.length > 0) {
        try {
          const imagePaths = formData.images.map(url => {
            const path = url.split('/listing-images/')[1];
            return `${user.id}/${path}`;
          }).filter(Boolean);

          if (imagePaths.length > 0) {
            await supabase.storage
              .from('listing-images')
              .remove(imagePaths);
          }
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError);
        }
      }

      toast({
        title: "Failed to create listing",
        description: error.message || "Please try again",
        variant: "destructive"
      });

      return false;
    } finally {
      setSubmissionLoading(false);
    }
  };

  const onSubmit = async (data: ListingFormValues) => {
    const success = await submitListing(data);
    
    if (success) {
      localStorage.removeItem(`listing-draft-${user?.id}`);
      navigate('/my-listings');
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.formState.isDirty]);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create Listing</h1>
          <p className="text-muted-foreground">Share an item or offer a service</p>
        </div>

        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    index <= currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground'
                  } ${
                    index === currentStep ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-xs mt-2 ${
                    index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{steps[currentStep].title}</CardTitle>
              </CardHeader>
              <CardContent>
                {CurrentStepComponent === ListingPreview ? (
                  <CurrentStepComponent formData={form.watch()} />
                ) : (
                  <CurrentStepComponent 
                    form={form} 
                    categories={categories || []}
                    userId={user?.id || ''}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <div>
                {!isFirstStep && (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    if (form.formState.isDirty) {
                      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                        navigate('/dashboard');
                      }
                    } else {
                      navigate('/dashboard');
                    }
                  }}
                >
                  Cancel
                </Button>

                {!isLastStep ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submissionLoading || !form.formState.isValid}>
                    {submissionLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Listing
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </DashboardLayout>
  );
};

// Final CreateListing Component
const CreateListing = () => {
  return <CreateListingWizard />;
};

export default CreateListing;

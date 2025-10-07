const OrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [counterOffer, setCounterOffer] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanType, setScanType] = useState<'delivery' | 'return' | 'service_start' | 'service_end'>('delivery');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Order not found');
      
      const [listingData, buyerData, sellerData] = await Promise.all([
        data.listing_id 
          ? supabase.from('listings').select('*, seller_profile:profiles(name, avatar_url)').eq('id', data.listing_id).single()
          : Promise.resolve({ data: null, error: null }),
        data.buyer_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.buyer_id).single()
          : Promise.resolve({ data: null, error: null }),
        data.seller_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.seller_id).single()
          : Promise.resolve({ data: null, error: null })
      ]);

      return {
        ...data,
        listings: listingData.data,
        buyer_profile: buyerData.data,
        seller_profile: sellerData.data
      };
    },
    enabled: !!id
  });

  const { data: negotiations } = useQuery({
    queryKey: ['negotiations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_negotiations')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const negotiationsWithProfiles = await Promise.all(
        (data || []).map(async (neg) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', neg.from_user_id)
            .single();
          
          return { ...neg, from_profile: profileData };
        })
      );
      
      return negotiationsWithProfiles;
    },
    enabled: !!id
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const sendNegotiationMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('order_negotiations')
        .insert([{ ...data, order_id: id, from_user_id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiations', id] });
      setCounterOffer('');
    }
  });

  const handleAcceptOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'accepted' });
    toast({ 
      title: 'Order accepted!', 
      description: 'The buyer will be notified and can proceed to payment'
    });
  };

  const handleDeclineOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'cancelled' });
    toast({ title: 'Order declined' });
  };

  const handleAcceptOffer = async (amount: number) => {
    await updateOrderMutation.mutateAsync({
      status: 'accepted',
      final_amount: amount * (order?.quantity || 1)
    });
    await sendNegotiationMutation.mutateAsync({
      action: 'accept',
      amount
    });
    toast({ title: 'Offer accepted!', description: 'Proceeding to payment' });
  };

  const handleCounterOffer = async () => {
    const amount = parseFloat(counterOffer);
    if (isNaN(amount) || amount <= 0) return;

    await sendNegotiationMutation.mutateAsync({
      action: 'counter',
      amount,
      message: `Counter offer: $${amount} per unit`
    });
    toast({ title: 'Counter offer sent!' });
  };

  const initiatePayment = async () => {
    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { order_id: id }
      });

      if (error) throw error;

      if (data?.url) {
        const paymentWindow = window.open(data.url, '_blank');
        
        if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
          toast({
            title: 'Popup blocked',
            description: 'Please allow popups or we will redirect you',
            variant: 'destructive'
          });
          setTimeout(() => { window.location.href = data.url; }, 2000);
        } else {
          toast({
            title: 'Redirecting to payment...',
            description: 'Complete your payment in the new window'
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Payment initialization failed',
        description: error.message || 'Unknown error occurred',
        variant: 'destructive'
      });
      console.error('Payment error:', error);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowQRDialog(true);
      toast({ title: 'QR Code generated!' });
    } catch (error: any) {
      toast({ title: 'Failed to generate QR code', description: error.message, variant: 'destructive' });
    }
  };

  const handleQRScan = async (qrData: any) => {
    try {
      const { data, error } = await supabase.rpc('verify_qr_scan', {
        p_order_id: id,
        p_qr_secret: qrData.secret,
        p_scan_type: scanType
      });
      if (error || !data) throw new Error('Invalid QR code');
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowScanDialog(false);
      toast({
        title: 'Scan successful!',
        description: scanType === 'delivery' ? 'Item delivered' : scanType === 'return' ? 'Item returned' : scanType === 'service_start' ? 'Service started' : 'Service completed'
      });
    } catch (error: any) {
      toast({ title: 'Scan failed', description: error.message, variant: 'destructive' });
    }
  };

  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    
    if (params.get('payment') === 'success' && sessionId && !isVerifying) {
      setIsVerifying(true);
      supabase.functions.invoke('verify-payment', { body: { session_id: sessionId, order_id: id } })
        .then(async ({ data, error }) => {
          if (error) {
            toast({ title: 'Payment verification failed', description: error.message || 'Please contact support', variant: 'destructive' });
          } else {
            toast({ title: 'Payment successful!', description: 'Your order has been confirmed.', duration: 5000 });
            await queryClient.invalidateQueries({ queryKey: ['order', id] });
            setTimeout(async () => {
              const { error: qrError } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
              if (!qrError) await queryClient.invalidateQueries({ queryKey: ['order', id] });
            }, 1000);
          }
          navigate(`/orders/${id}`, { replace: true });
          setIsVerifying(false);
        })
        .catch(() => {
          toast({ title: 'Verification error', description: 'An unexpected error occurred', variant: 'destructive' });
          setIsVerifying(false);
        });
    } else if (params.get('payment') === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'You can try again when ready', variant: 'default' });
      navigate(`/orders/${id}`, { replace: true });
    }
  }, [id, isVerifying]);

  if (isLoading) return <div>Loading...</div>;
  if (!order) return <div>Order not found</div>;

  // ✅ NEW: COD or Paid check
  const isPaidOrCOD = order.status === 'paid' 
    || order.status === 'in_progress' 
    || order.status === 'completed' 
    || order.payment_method === 'cod';

  const isBuyer = order.buyer_id === user?.id;
  const isSeller = order.seller_id === user?.id;

  return (
    <div>
      {/* Order details, listing, buyer/seller info, negotiations */}
      
      {/* Payment / COD button logic */}
      {isBuyer && order.status === 'accepted' && !isPaidOrCOD && order.payment_method === 'stripe' && (
        <Button onClick={initiatePayment} disabled={isPaymentLoading || isVerifying}>
          {isPaymentLoading ? 'Opening payment page...' : isVerifying ? 'Verifying payment...' : 'Proceed to Payment'}
        </Button>
      )}

      {isBuyer && order.payment_method === 'cod' && (
        <Button disabled>
          Cash on Delivery Selected
        </Button>
      )}

      {/* QR code / Delivery actions */}
      {isPaidOrCOD && !order.delivery_scanned_at && (
        <Button onClick={generateQRCode}>Generate Delivery QR</Button>
      )}

      {/* Negotiation section */}
      {isBuyer && order.status === 'pending' && (
        <div>
          <Input value={counterOffer} onChange={(e) => setCounterOffer(e.target.value)} />
          <Button onClick={handleCounterOffer}>Send Counter Offer</Button>
        </div>
      )}

      {isSeller && negotiations?.length > 0 && (
        <div>
          {negotiations.map((neg) => (
            <div key={neg.id}>
              <p>{neg.from_profile?.name}: {neg.amount} ({neg.action})</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

-- Create trigger function for order notifications
CREATE OR REPLACE FUNCTION public.notify_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name text;
  v_seller_name text;
  v_listing_title text;
BEGIN
  -- Get related data
  SELECT p.name INTO v_buyer_name FROM profiles p WHERE p.id = NEW.buyer_id;
  SELECT p.name INTO v_seller_name FROM profiles p WHERE p.id = NEW.seller_id;
  SELECT l.title INTO v_listing_title FROM listings l WHERE l.id = NEW.listing_id;
  
  -- Handle INSERT (new order)
  IF TG_OP = 'INSERT' THEN
    -- Notify seller
    PERFORM create_notification(
      NEW.seller_id,
      'order_update',
      'New Order Received',
      v_buyer_name || ' wants to borrow ' || v_listing_title,
      jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
      '/orders/' || NEW.id,
      'View Order',
      'high'
    );
    
    -- Notify buyer (confirmation)
    PERFORM create_notification(
      NEW.buyer_id,
      'order_update',
      'Order Placed',
      'Your order for ' || v_listing_title || ' has been placed',
      jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
      '/orders/' || NEW.id,
      'View Order',
      'medium'
    );
  END IF;
  
  -- Handle UPDATE (status change)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'accepted' THEN
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Order Accepted',
        v_seller_name || ' accepted your order for ' || v_listing_title,
        jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
        '/orders/' || NEW.id,
        'View Order',
        'high'
      );
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Order Cancelled',
        'Your order for ' || v_listing_title || ' was cancelled',
        jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
        '/orders/' || NEW.id,
        'View Order',
        'medium'
      );
    ELSIF NEW.status = 'paid' THEN
      PERFORM create_notification(
        NEW.seller_id,
        'order_update',
        'Payment Received',
        'Payment confirmed for ' || v_listing_title,
        jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
        '/orders/' || NEW.id,
        'View Order',
        'high'
      );
    ELSIF NEW.status = 'completed' THEN
      -- Notify both parties
      PERFORM create_notification(
        NEW.seller_id,
        'order_update',
        'Order Completed',
        'Order completed for ' || v_listing_title,
        jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
        '/orders/' || NEW.id,
        'Leave Review',
        'medium'
      );
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Order Completed',
        'Your rental of ' || v_listing_title || ' is complete',
        jsonb_build_object('order_id', NEW.id, 'listing_id', NEW.listing_id),
        '/orders/' || NEW.id,
        'Leave Review',
        'medium'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for orders
DROP TRIGGER IF EXISTS order_notification_trigger ON public.orders;
CREATE TRIGGER order_notification_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_changes();

-- Create trigger function for service order notifications
CREATE OR REPLACE FUNCTION public.notify_service_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name text;
  v_provider_name text;
  v_service_title text;
BEGIN
  -- Get related data
  SELECT p.name INTO v_buyer_name FROM profiles p WHERE p.id = NEW.buyer_id;
  SELECT p.name INTO v_provider_name FROM profiles p WHERE p.id = NEW.provider_id;
  SELECT s.title INTO v_service_title FROM services s WHERE s.id = NEW.service_id;
  
  -- Handle INSERT (new service order)
  IF TG_OP = 'INSERT' THEN
    -- Notify provider
    PERFORM create_notification(
      NEW.provider_id,
      'order_update',
      'New Service Request',
      v_buyer_name || ' requested ' || v_service_title,
      jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
      '/service-orders/' || NEW.id,
      'View Request',
      'high'
    );
    
    -- Notify buyer (confirmation)
    PERFORM create_notification(
      NEW.buyer_id,
      'order_update',
      'Service Request Sent',
      'Your request for ' || v_service_title || ' has been sent',
      jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
      '/service-orders/' || NEW.id,
      'View Request',
      'medium'
    );
  END IF;
  
  -- Handle UPDATE (status change)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'accepted' THEN
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Service Request Accepted',
        v_provider_name || ' accepted your request for ' || v_service_title,
        jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
        '/service-orders/' || NEW.id,
        'View Request',
        'high'
      );
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Service Request Cancelled',
        'Your request for ' || v_service_title || ' was cancelled',
        jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
        '/service-orders/' || NEW.id,
        'View Request',
        'medium'
      );
    ELSIF NEW.status = 'completed' THEN
      PERFORM create_notification(
        NEW.buyer_id,
        'order_update',
        'Service Completed',
        v_service_title || ' has been completed',
        jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
        '/service-orders/' || NEW.id,
        'Leave Review',
        'medium'
      );
      PERFORM create_notification(
        NEW.provider_id,
        'order_update',
        'Service Completed',
        'Service completed for ' || v_buyer_name,
        jsonb_build_object('service_order_id', NEW.id, 'service_id', NEW.service_id),
        '/service-orders/' || NEW.id,
        'View Request',
        'medium'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for service orders
DROP TRIGGER IF EXISTS service_order_notification_trigger ON public.service_orders;
CREATE TRIGGER service_order_notification_trigger
  AFTER INSERT OR UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_order_changes();
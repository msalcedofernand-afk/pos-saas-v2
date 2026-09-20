-- Role lookup is performed by the server with the admin client, not by browser RPC.
REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM authenticated;

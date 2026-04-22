// server/models/refreshTokenModel.js
const { supabase } = require('./db');

const findRefreshToken = async (token) => {
    const { data, error } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();
    if (error) throw error;
    return data;
};

const createRefreshToken = async ({ userId, token, expiresAt, familyId }) => {
    const { data, error } = await supabase
        .from('refresh_tokens')
        .insert([{
            "userId": userId,
            "token": token,
            "expiresAt": expiresAt,
            "familyId": familyId,
            "isRevoked": false
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

const revokeRefreshToken = async (tokenId) => {
    const { error } = await supabase
        .from('refresh_tokens')
        .update({ "isRevoked": true })
        .eq('id', tokenId);
    if (error) throw error;
};

const revokeFamily = async (familyId) => {
    const { error } = await supabase
        .from('refresh_tokens')
        .update({ "isRevoked": true })
        .eq('familyId', familyId);
    if (error) throw error;
};

const deleteExpiredTokens = async () => {
    const { error } = await supabase
        .from('refresh_tokens')
        .delete()
        .lt('expiresAt', new Date().toISOString());
    if (error) throw error;
};

module.exports = {
    findRefreshToken,
    createRefreshToken,
    revokeRefreshToken,
    revokeFamily,
    deleteExpiredTokens
};

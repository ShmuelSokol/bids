-- dbo.aq_quote_send_log_1_view



/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */

/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */


/* view aq_quote_send_log_1_view: add view */
CREATE VIEW [dbo].[aq_quote_send_log_1_view]
AS
SELECT DISTINCT 
                         dbo.solicitation_line_1_view.sol_no_k10, dbo.solicitation_line_1_view.fsc_k08, dbo.solicitation_line_1_view.niin_k08, dbo.kd8_tab.q_time_kd8, dbo.kd8_tab.qtopoc_kd8, dbo.kd8_tab.orefno_kd8, 
                         dbo.kd8_tab.q_clas_kd8, dbo.kd8_tab.mfg_pn_kd8, dbo.kd8_tab.valday_kd8, dbo.solicitation_line_1_view.p_desc_k08, dbo.k14_tab.u_name_k14, dbo.k14_tab.idnk14_k14, 
                         dbo.solicitation_line_1_view.idnk08_k08, dbo.solicitation_line_1_view.idnk10_k10, dbo.kd8_tab.bidtyp_kd8, dbo.kd8_tab.fobcod_kd8, dbo.kd8_tab.insmat_kd8, dbo.kd8_tab.acc_sd_kd8, dbo.kd8_tab.idnkd8_kd8, 
                         dbo.kd8_tab.q_stat_kd8, dbo.aq_partner_1_view.d_code_too AS d_code_ka7, dbo.aq_partner_1_view.d_name_too AS d_name_ka7, dbo.aq_partner_1_view.d_emal_too AS d_emal_ka7, 
                         dbo.aq_partner_1_view.d_attn_too AS d_attn_ka7, dbo.kd8_tab.ptrk12_kd8, dbo.kd8_tab.took12_kd8, dbo.kd8_tab.mfgk12_kd8, mfg_tab.e_code_k12 AS e_code_mfg, dbo.aq_partner_1_view.idnk12_ptr, 
                         dbo.aq_partner_1_view.e_code_ptr, dbo.aq_partner_1_view.e_name_ptr, dbo.aq_partner_1_view.q_mode_kdh
FROM            dbo.kd8_tab INNER JOIN
                         dbo.solicitation_line_1_view ON dbo.kd8_tab.idnkc4_kd8 = dbo.solicitation_line_1_view.idnkc4_kc4 INNER JOIN
                         dbo.k14_tab ON dbo.kd8_tab.idnk14_kd8 = dbo.k14_tab.idnk14_k14 INNER JOIN
                         dbo.aq_partner_1_view ON dbo.kd8_tab.took12_kd8 = dbo.aq_partner_1_view.idnk12_too AND dbo.kd8_tab.ptrk12_kd8 = dbo.aq_partner_1_view.idnk12_ptr INNER JOIN
                         dbo.k12_tab AS mfg_tab ON dbo.kd8_tab.mfgk12_kd8 = mfg_tab.idnk12_k12



















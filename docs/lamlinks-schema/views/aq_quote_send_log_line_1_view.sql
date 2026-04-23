-- dbo.aq_quote_send_log_line_1_view



/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */

/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */


/* view aq_quote_send_log_line_1_view: add view */
CREATE VIEW [dbo].[aq_quote_send_log_line_1_view]
AS
SELECT        dbo.aq_quote_send_log_1_view.sol_no_k10, dbo.aq_quote_send_log_1_view.fsc_k08, dbo.aq_quote_send_log_1_view.niin_k08, dbo.aq_quote_send_log_1_view.q_time_kd8, 
                         dbo.aq_quote_send_log_1_view.qtopoc_kd8, dbo.aq_quote_send_log_1_view.orefno_kd8, dbo.aq_quote_send_log_1_view.q_clas_kd8, dbo.aq_quote_send_log_1_view.mfg_pn_kd8, 
                         dbo.aq_quote_send_log_1_view.valday_kd8, dbo.aq_quote_send_log_1_view.p_desc_k08, dbo.aq_quote_send_log_1_view.u_name_k14, dbo.aq_quote_send_log_1_view.idnk14_k14, 
                         dbo.aq_quote_send_log_1_view.idnk08_k08, dbo.aq_quote_send_log_1_view.idnk10_k10, dbo.aq_quote_send_log_1_view.bidtyp_kd8, dbo.aq_quote_send_log_1_view.fobcod_kd8, 
                         dbo.aq_quote_send_log_1_view.insmat_kd8, dbo.aq_quote_send_log_1_view.acc_sd_kd8, dbo.aq_quote_send_log_1_view.idnkd8_kd8, dbo.aq_quote_send_log_1_view.q_stat_kd8, 
                         dbo.aq_quote_send_log_1_view.d_code_ka7, dbo.aq_quote_send_log_1_view.d_name_ka7, dbo.aq_quote_send_log_1_view.d_emal_ka7, dbo.aq_quote_send_log_1_view.d_attn_ka7, dbo.kda_tab.qteqty_kda, 
                         dbo.kda_tab.uprice_kda, dbo.kda_tab.qte_ui_kda, dbo.kda_tab.dlyaro_kda, dbo.kda_tab.idnkda_kda, dbo.aq_quote_send_log_1_view.ptrk12_kd8, dbo.aq_quote_send_log_1_view.took12_kd8, 
                         dbo.aq_quote_send_log_1_view.mfgk12_kd8, dbo.aq_quote_send_log_1_view.e_code_mfg, dbo.aq_quote_send_log_1_view.e_code_ptr, dbo.aq_quote_send_log_1_view.e_name_ptr, 
                         dbo.aq_quote_send_log_1_view.q_mode_kdh
FROM            dbo.aq_quote_send_log_1_view LEFT OUTER JOIN
                         dbo.kda_tab ON dbo.aq_quote_send_log_1_view.idnkd8_kd8 = dbo.kda_tab.idnkd8_kda



















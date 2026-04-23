-- dbo.aq_quote_transmission_1_view



/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */

/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */


/* view aq_quote_transmission_1_view: add view */
CREATE VIEW [dbo].[aq_quote_transmission_1_view]
AS
SELECT        dbo.aq_quote_send_log_line_1_view.sol_no_k10, dbo.aq_quote_send_log_line_1_view.fsc_k08, dbo.aq_quote_send_log_line_1_view.niin_k08, dbo.aq_quote_send_log_line_1_view.q_time_kd8, 
                         dbo.aq_quote_send_log_line_1_view.qtopoc_kd8, dbo.aq_quote_send_log_line_1_view.orefno_kd8, dbo.aq_quote_send_log_line_1_view.q_clas_kd8, dbo.aq_quote_send_log_line_1_view.mfg_pn_kd8, 
                         dbo.aq_quote_send_log_line_1_view.valday_kd8, dbo.aq_quote_send_log_line_1_view.p_desc_k08, dbo.aq_quote_send_log_line_1_view.u_name_k14, dbo.aq_quote_send_log_line_1_view.idnk14_k14, 
                         dbo.aq_quote_send_log_line_1_view.idnk08_k08, dbo.aq_quote_send_log_line_1_view.idnk10_k10, dbo.aq_quote_send_log_line_1_view.bidtyp_kd8, dbo.aq_quote_send_log_line_1_view.fobcod_kd8, 
                         dbo.aq_quote_send_log_line_1_view.insmat_kd8, dbo.aq_quote_send_log_line_1_view.acc_sd_kd8, dbo.aq_quote_send_log_line_1_view.idnkd8_kd8, dbo.aq_quote_send_log_line_1_view.q_stat_kd8, 
                         dbo.aq_quote_send_log_line_1_view.d_code_ka7, dbo.aq_quote_send_log_line_1_view.d_name_ka7, dbo.aq_quote_send_log_line_1_view.d_emal_ka7, dbo.aq_quote_send_log_line_1_view.d_attn_ka7, 
                         dbo.aq_quote_send_log_line_1_view.qteqty_kda, dbo.aq_quote_send_log_line_1_view.uprice_kda, dbo.aq_quote_send_log_line_1_view.qte_ui_kda, dbo.aq_quote_send_log_line_1_view.dlyaro_kda, 
                         dbo.aq_quote_send_log_line_1_view.idnkda_kda, dbo.kdb_tab.t_clas_kdb, dbo.kdb_tab.t_time_kdb, dbo.kdb_tab.t_stat_kdb, dbo.kdb_tab.t_comp_kdb, dbo.aq_quote_send_log_line_1_view.q_mode_kdh
FROM            dbo.aq_quote_send_log_line_1_view LEFT OUTER JOIN
                         dbo.kdb_tab ON dbo.aq_quote_send_log_line_1_view.idnkd8_kd8 = dbo.kdb_tab.idnkd8_kdb



















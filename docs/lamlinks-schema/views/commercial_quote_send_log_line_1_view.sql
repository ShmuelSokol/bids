-- dbo.commercial_quote_send_log_line_1_view



/* view commercial_quote_send_log_line_1_view: add view */


/* view commercial_quote_send_log_line_1_view: add view */


/* view commercial_quote_send_log_line_1_view: add view */

/* view commercial_quote_send_log_line_1_view: add view */


/* view commercial_quote_send_log_line_1_view: add view */


/* view commercial_quote_send_log_line_1_view: add view */
CREATE VIEW [dbo].[commercial_quote_send_log_line_1_view]
AS
SELECT     dbo.commercial_quote_send_log_1_view.d_code_ka7, dbo.commercial_quote_send_log_1_view.d_name_ka7, dbo.kda_tab.qteqty_kda, dbo.kda_tab.uprice_kda, 
                      dbo.kda_tab.qte_ui_kda, dbo.kda_tab.dlyaro_kda, dbo.commercial_quote_send_log_1_view.sol_no_k10, dbo.commercial_quote_send_log_1_view.fsc_k08, 
                      dbo.commercial_quote_send_log_1_view.niin_k08, dbo.commercial_quote_send_log_1_view.q_time_kd8, dbo.commercial_quote_send_log_1_view.qtopoc_kd8, 
                      dbo.commercial_quote_send_log_1_view.orefno_kd8, dbo.commercial_quote_send_log_1_view.q_clas_kd8, dbo.commercial_quote_send_log_1_view.mfg_pn_kd8, 
                      dbo.commercial_quote_send_log_1_view.valday_kd8, dbo.commercial_quote_send_log_1_view.p_desc_k08, dbo.commercial_quote_send_log_1_view.u_name_k14, 
                      dbo.commercial_quote_send_log_1_view.idnk14_k14, dbo.commercial_quote_send_log_1_view.idnk08_k08, dbo.commercial_quote_send_log_1_view.idnk10_k10, 
                      dbo.commercial_quote_send_log_1_view.bidtyp_kd8, dbo.commercial_quote_send_log_1_view.fobcod_kd8, dbo.commercial_quote_send_log_1_view.insmat_kd8, 
                      dbo.commercial_quote_send_log_1_view.acc_sd_kd8, dbo.commercial_quote_send_log_1_view.idnkd8_kd8, dbo.commercial_quote_send_log_1_view.q_stat_kd8, 
                      dbo.commercial_quote_send_log_1_view.source_k09, dbo.commercial_quote_send_log_1_view.mfgk12_kd8, dbo.commercial_quote_send_log_1_view.ptrk12_kd8, 
                      dbo.commercial_quote_send_log_1_view.took12_kd8, dbo.commercial_quote_send_log_1_view.trmdes_k06, dbo.commercial_quote_send_log_1_view.qtemal_kd8, 
                      dbo.commercial_quote_send_log_1_view.gduset_ka7
FROM         dbo.kda_tab INNER JOIN
                      dbo.commercial_quote_send_log_1_view ON dbo.kda_tab.idnkd8_kda = dbo.commercial_quote_send_log_1_view.idnkd8_kd8







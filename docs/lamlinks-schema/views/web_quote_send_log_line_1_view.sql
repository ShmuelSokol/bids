-- dbo.web_quote_send_log_line_1_view



/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */

/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */


/* view web_quote_send_log_line_1_view: add view */
/* view web_quote_send_log_line_1_view: add view 
 view web_quote_send_log_line_1_view: add view 
 view web_quote_send_log_line_1_view: add view 
 view web_quote_send_log_line_1_view: add view 
 view web_quote_send_log_line_1_view: add view 
 view web_quote_send_log_line_1_view: add view */
CREATE VIEW [dbo].[web_quote_send_log_line_1_view]
AS
SELECT        dbo.web_quote_send_log_1_view.d_code_ka7, dbo.web_quote_send_log_1_view.d_name_ka7, dbo.kda_tab.qteqty_kda, dbo.kda_tab.uprice_kda, dbo.kda_tab.qte_ui_kda, dbo.kda_tab.dlyaro_kda, 
                         dbo.web_quote_send_log_1_view.sol_no_k10, dbo.web_quote_send_log_1_view.fsc_k08, dbo.web_quote_send_log_1_view.niin_k08, dbo.web_quote_send_log_1_view.q_time_kd8, 
                         dbo.web_quote_send_log_1_view.qtopoc_kd8, dbo.web_quote_send_log_1_view.orefno_kd8, dbo.web_quote_send_log_1_view.q_clas_kd8, dbo.web_quote_send_log_1_view.mfg_pn_kd8, 
                         dbo.web_quote_send_log_1_view.valday_kd8, dbo.web_quote_send_log_1_view.p_desc_k08, dbo.web_quote_send_log_1_view.u_name_k14, dbo.web_quote_send_log_1_view.idnk14_k14, 
                         dbo.web_quote_send_log_1_view.idnk08_k08, dbo.web_quote_send_log_1_view.idnk10_k10, dbo.web_quote_send_log_1_view.bidtyp_kd8, dbo.web_quote_send_log_1_view.fobcod_kd8, 
                         dbo.web_quote_send_log_1_view.insmat_kd8, dbo.web_quote_send_log_1_view.acc_sd_kd8, dbo.web_quote_send_log_1_view.idnkd8_kd8, dbo.web_quote_send_log_1_view.q_stat_kd8, 
                         dbo.web_quote_send_log_1_view.source_k09, dbo.web_quote_send_log_1_view.mfgk12_kd8, dbo.web_quote_send_log_1_view.ptrk12_kd8, dbo.web_quote_send_log_1_view.took12_kd8, 
                         dbo.web_quote_send_log_1_view.qtemal_kd8, dbo.web_quote_send_log_1_view.gduset_ka7, dbo.web_quote_send_log_1_view.idnk34_k34, dbo.k34_tab.pn_rev_k34, dbo.k34_tab.szip_k34, 
                         dbo.k34_tab.gennte_k34, dbo.k34_tab.mcage_k34, dbo.web_quote_send_log_1_view.idnk06_k06, dbo.web_quote_send_log_1_view.trmdes_k06, dbo.web_quote_send_log_1_view.qstext_kd8, 
                         dbo.web_quote_send_log_1_view.q_mode_kdh, dbo.web_quote_send_log_1_view.idnkdh_kdh, dbo.kd8_tab.qclxml_kd8
FROM            dbo.kda_tab INNER JOIN
                         dbo.web_quote_send_log_1_view ON dbo.kda_tab.idnkd8_kda = dbo.web_quote_send_log_1_view.idnkd8_kd8 INNER JOIN
                         dbo.kd8_tab ON dbo.web_quote_send_log_1_view.idnkd8_kd8 = dbo.kd8_tab.idnkd8_kd8 LEFT OUTER JOIN
                         dbo.k34_tab ON dbo.web_quote_send_log_1_view.idnk34_k34 = dbo.k34_tab.idnk34_k34













-- dbo.web_rfq_individuals_1_view



/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */

/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */


/* view web_rfq_individuals_1_view: add view */
CREATE VIEW [dbo].[web_rfq_individuals_1_view]
AS
SELECT        dbo.web_rfq_send_control_1_view.rfq_no_kdk, too_k12_tab.e_code_k12 AS e_code_too, too_k12_tab.e_name_k12 AS e_name_too, too_k12_tab.idnk12_k12, dbo.kdm_tab.srfqno_kdm, dbo.kdm_tab.toopoc_kdm, 
                         dbo.kdm_tab.tooeml_kdm, dbo.kdm_tab.t_clas_kdm, dbo.kdm_tab.r_stat_kdm, dbo.kdm_tab.rstime_kdm, dbo.kdm_tab.rstext_kdm, dbo.web_rfq_send_control_1_view.idnkdk_kdk, 
                         dbo.web_rfq_send_control_1_view.adtime_kdk, dbo.web_rfq_send_control_1_view.email_k36 AS e_mail_frm, dbo.web_rfq_send_control_1_view.rfqpoc_k36 AS pocnam_frm, dbo.kdm_tab.idnkdm_kdm, 
                         dbo.web_rfq_send_control_1_view.cfznam_kdk,
                             (SELECT        COUNT(idnkdn_kdn) AS kdncnt_kdm
                               FROM            dbo.kdn_tab
                               WHERE        (idnkdm_kdn = dbo.kdm_tab.idnkdm_kdm)) AS kdncnt_kdm, dbo.kdm_tab.bdytyp_kdm
FROM            dbo.k12_tab AS too_k12_tab INNER JOIN
                         dbo.kdm_tab ON too_k12_tab.idnk12_k12 = dbo.kdm_tab.took12_kdm INNER JOIN
                         dbo.web_rfq_send_control_1_view ON dbo.kdm_tab.idnkdk_kdm = dbo.web_rfq_send_control_1_view.idnkdk_kdk
















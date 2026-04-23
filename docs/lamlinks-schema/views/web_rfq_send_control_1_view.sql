-- dbo.web_rfq_send_control_1_view



/* view web_rfq_send_control_1_view: add view */


/* view web_rfq_send_control_1_view: add view */


/* view web_rfq_send_control_1_view: add view */

/* view web_rfq_send_control_1_view: add view */


/* view web_rfq_send_control_1_view: add view */


/* view web_rfq_send_control_1_view: add view */
CREATE VIEW [dbo].[web_rfq_send_control_1_view]
AS
SELECT        dbo.kdk_tab.rfq_no_kdk, dbo.kdk_tab.r_stat_kdk, dbo.kdk_tab.rstime_kdk, dbo.rfq_control_our_poc_1_view.email_k36, dbo.rfq_control_our_poc_1_view.rfqpoc_k36, dbo.rfq_control_our_poc_1_view.a_note_kah, 
                         dbo.k42_tab.idnk42_k42, dbo.kdk_tab.cfznam_kdk, dbo.kdk_tab.pdfnam_kdk, dbo.k39_tab.idnk12_k39 AS idnk12_k12, dbo.k39_tab.idnk39_k39, dbo.rfq_control_our_poc_1_view.idnk14_k14, 
                         dbo.kdk_tab.idnkdk_kdk, dbo.kdk_tab.totime_kdk, dbo.kdk_tab.to_act_kdk, dbo.kdk_tab.rstext_kdk, dbo.kdk_tab.adtime_kdk, dbo.kdk_tab.xlsnam_kdk, dbo.kdk_tab.tdpnam_kdk, dbo.kdk_tab.uptime_kdk
FROM            dbo.k42_tab RIGHT OUTER JOIN
                         dbo.kdk_tab INNER JOIN
                         dbo.rfq_control_our_poc_1_view ON dbo.kdk_tab.idnk36_kdk = dbo.rfq_control_our_poc_1_view.idnk36_k36 ON dbo.k42_tab.idnk42_k42 = dbo.kdk_tab.idnk42_kdk LEFT OUTER JOIN
                         dbo.k39_tab ON dbo.k42_tab.idnk39_k42 = dbo.k39_tab.idnk39_k39







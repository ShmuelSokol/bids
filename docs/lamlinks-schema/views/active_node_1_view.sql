-- dbo.active_node_1_view



/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */

/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */


/* view active_node_1_view: add view */
CREATE VIEW [dbo].[active_node_1_view]
AS
SELECT     D01_tab.nodeid_d01, D01_tab.nodesc_d01, D03_tab.rankno_d03, D02_tab.sysnam_d02, D02_tab.wrknam_d02, D02_tab.wrkfun_d02, D02_tab.wrkprm_d02, 
                      D03_tab.maxact_d03, D03_tab.autoaf_d03, D04_tab.actseq_d04, D04_tab.nodseq_d04, D04_tab.taskid_d04, D04_tab.loginn_d04, D04_tab.apstme_d04, 
                      D04_tab.acpsta_d04, D04_tab.acptme_d04, D04_tab.acrtme_d04, D04_tab.axctme_d04, D04_tab.jobnam_d04, D04_tab.stpnam_d04, D04_tab.stpmsg_d04, 
                      D04_tab.xrtype_d04, D04_tab.sysxml_d04, D01_tab.idnd01_d01, D02_tab.idnd02_d02, D03_tab.idnd03_d03, D04_tab.idnd04_d04
FROM         dbo.d03_tab AS D03_tab INNER JOIN
                      dbo.d01_tab AS D01_tab ON D03_tab.idnd01_d03 = D01_tab.idnd01_d01 INNER JOIN
                      dbo.d02_tab AS D02_tab ON D03_tab.idnd02_d03 = D02_tab.idnd02_d02 INNER JOIN
                      dbo.d04_tab AS D04_tab ON D03_tab.idnd03_d03 = D04_tab.idnd03_d04


















